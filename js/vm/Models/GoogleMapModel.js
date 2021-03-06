define([
    'knockout',
    'js/vm/helpers',
    'dotdotdot',
    'js/vm/Models/HotelsBaseModel',
    'js/vm/Models/RecentHotelsModel',
    'js/vm/Common/Cache/Cache',
	'js/lib/md5/md5'
], function (ko,
			 helpers,
			 dotdotdot,
			 HotelsBaseModel,
			 RecentHotelsModel,
			 Cache,
			 md5) {

    function GoogleMapModel() {

    }

    GoogleMapModel.prototype.infoWindowHotel = ko.observable(null);
    GoogleMapModel.prototype.infoPopup = null;
    GoogleMapModel.prototype.maps = {};

    var getMarkerIcon = function (iconType) {
        return {
            url: '/img/' + iconType + '.svg',
            scaledSize: new google.maps.Size(GoogleMapModel.MAP_SIZE_WIDTH, GoogleMapModel.MAP_SIZE_HEIGHT)
        };
    };

    function makeMap(id, coords, scrollOnWheel, disableZoomAndStreetViewControl) {
        return new google.maps.Map(document.getElementById(id), {
            center: {lat: coords[0], lng: coords[1]},
            zoom: GoogleMapModel.DEFAULT_ZOOM,
            scrollwheel: typeof scrollOnWheel === 'undefined' ? true : scrollOnWheel,
            zoomControl: !disableZoomAndStreetViewControl,
            streetViewControl: !disableZoomAndStreetViewControl
        });
    }

    /**
     *
     * @param map
     * @param {Object} options
     * @param {Object} options.hotel
     * @param {Boolean} options.addClickListener
     * @param {String} options.iconColor
     */
    GoogleMapModel.prototype.makeMarker = function (map, options) {

        var addClickListener = typeof options.addClickListener === 'undefined' ? false : options.addClickListener,
            hotel = options.hotel,
            iconType = options.iconColor,
            self = this,

            marker = new google.maps.Marker({
                position: new google.maps.LatLng(
                    hotel.staticDataInfo.posLatitude,
                    hotel.staticDataInfo.posLongitude
                ),
                map: map,
                icon: getMarkerIcon(iconType),
                optimized: false,
                content: Cache.storage().get(md5('/html/partials/nemo-koTemplate-HotelsResults-MapInfoWindow.html'))
            });

        if (this.infoPopup) {
            this.infoPopup.close();
        }

        this.infoPopup = new google.maps.InfoWindow();

        // Add click event on marker
        if (addClickListener) {
            google.maps.event.addListener(marker, 'click', function () {
                self.infoWindowHotel(hotel);
                self.infoPopup.setContent($('#infoWindowContentTemplate .mapItem')[0]);
                self.infoPopup.open(map, marker);
                $('#infoWindowContent .description .text').dotdotdot({watch: 'window'});
            });
        }

        return marker;
    };

    // map with one hotel
    GoogleMapModel.prototype.initHotelCardMap = function (hotel, mapId) {

        var scrollOnWheel = false,
            disableZoomAndStreetViewControl = false;

        switch (mapId) {
            // map on tab "About hotel"
            case 'aboutLocationMap':{
                break;
            }
            // full screen map
            case 'hotelBigMap':{
                scrollOnWheel = true;
                break;
            }
            // mini map on hotel card
            case 'cardHotelMap':{
                scrollOnWheel = true;
                disableZoomAndStreetViewControl = true;
                break;
            }
        }

        var lat = hotel.staticDataInfo.posLatitude || 0,
            lon = hotel.staticDataInfo.posLongitude || 0;

        this.maps[mapId] = makeMap(mapId, [lat, lon], scrollOnWheel, disableZoomAndStreetViewControl);

        this.makeMarker(this.maps[mapId], {hotel: hotel, addClickListener: false, iconColor: GoogleMapModel.ICON_TYPE_DEFAULT});
    };

    // Check center of map
    var checkGeocoderLocation = function (currentCity, fnOk, fnFail) {

        var geocoder = new google.maps.Geocoder();

        geocoder.geocode({address: currentCity}, function (results, status) {
            // If we know location it'll be center
            if (status === google.maps.GeocoderStatus.OK) {
                fnOk({lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng()});
            } else {
                fnFail(status);
            }
        });
    };

    // map with more then one hotel
    GoogleMapModel.prototype.initMap = function () {

        var self = this,
            hotels = this.inCircleFilteredHotels ? this.inCircleFilteredHotels() : [];

        // Init map and show center
        this.maps['map'] = makeMap('map', [GoogleMapModel.DEFAULT_COORDINATE_LAT, GoogleMapModel.DEFAULT_COORDINATE_LNG], true, false);

        // Add circle overlay and bind to center
        this.circle = new google.maps.Circle({
            map: this.maps['map'],
            fillOpacity: GoogleMapModel.circleParams.fillOpacity,
            strokeColor: GoogleMapModel.circleParams.strokeColor,
            radius: GoogleMapModel.circleParams.radius,
            strokeWeight: GoogleMapModel.circleParams.strokeWeight
        });

        function setMapCenter(centerLocation) {

            self.maps['map'].setCenter(centerLocation);

            self.circle.setCenter(centerLocation);
            self.setHotelsDistancesFromCenter(self.hotels(), centerLocation);

            if (self.distanceFromCenter) {
                self.distanceFromCenter.rangeMin(GoogleMapModel.MAP_DISTANCE_DEFAULT);
                self.distanceFromCenter.displayRangeMin(GoogleMapModel.MAP_DISTANCE_DEFAULT);
            }
        }

        checkGeocoderLocation(this.currentCity(), function (centerLocation) {
            setMapCenter(centerLocation);
        }, function () {

            var hotel = hotels[0];

            if (hotel) {
                var centerLocation = {lat: hotel.staticDataInfo.posLatitude, lng: hotel.staticDataInfo.posLongitude};
            }

            setMapCenter(centerLocation);
        });

        // Add markers on map
        var bounds = this.addMarkersOnMap(hotels);

        if (bounds) {
            this.maps['map'].fitBounds(bounds);
            this.maps['map'].panToBounds(bounds);
        }
    };

    GoogleMapModel.prototype.setHotelsDistancesFromCenter = function (hotels, centerLocation) {

        hotels.forEach(function (hotel) {

            hotel.distanceFromCenter = 0;

            var lat = hotel.staticDataInfo.posLatitude,
                lon = hotel.staticDataInfo.posLongitude;

            if (lat && lon) {
                hotel.distanceFromCenter = helpers.calculateDistanceBetweenTwoCoordinates(
                    {lat: centerLocation.lat, lng: centerLocation.lng},
                    {lat: lat, lng: lon}
                );
            }
        });
    };

    GoogleMapModel.prototype.removeMarkersFromMap = function (markers) {
        markers.forEach(function (marker) {
            marker.setMap(null);
        });
    };

    GoogleMapModel.prototype.addMarkersOnMap = function (hotels) {

        var self = this,
            bounds = new google.maps.LatLngBounds(),
            isBounded = false,
            markers = [];

        this.removeMarkersFromMap(this.oldMarkers());

        hotels.forEach(function (hotel) {

            var lat = hotel.staticDataInfo.posLatitude,
                lon = hotel.staticDataInfo.posLongitude;

            if (lat && lon) {

                var isHotelViewed = !!RecentHotelsModel.getHotelById(hotel.id),
                    isHotelWithBestPrice = hotel.staticDataInfo.isBestPrice,
                    iconType;

                // Add marker on map
                if (isHotelViewed && isHotelWithBestPrice) {
                    iconType = GoogleMapModel.ICON_TYPE_RECENT_AND_BEST_PRICE;
                } else if (isHotelWithBestPrice) {
                    iconType = GoogleMapModel.ICON_TYPE_BEST_PRICE;
                } else if (isHotelViewed) {
                    iconType = GoogleMapModel.ICON_TYPE_RECENT;
                } else {
                    iconType = GoogleMapModel.ICON_TYPE_DEFAULT;
                }

                markers.push(self.makeMarker(self.maps['map'], {
                    hotel: hotel,
                    addClickListener: true,
                    iconColor: iconType
                }));

                bounds.extend(new google.maps.LatLng(lat, lon));

                isBounded = true;
            }
        });

        this.oldMarkers(markers);

        return isBounded ? bounds : null;
    };

    GoogleMapModel.circleParams = {
        fillOpacity: 0,
        strokeColor: '#0D426D',
        radius: 3000,
        strokeWeight: 1
    };

    GoogleMapModel.MAP_SIZE_WIDTH = 40;
    GoogleMapModel.MAP_SIZE_HEIGHT = 35;

    GoogleMapModel.MAP_DISTANCE_MIN = 1;
    GoogleMapModel.MAP_DISTANCE_MAX = 30;
    GoogleMapModel.MAP_DISTANCE_DEFAULT = 3;

    GoogleMapModel.DEFAULT_ZOOM = 15;

    GoogleMapModel.DEFAULT_COORDINATE_LAT = 50.4546600;
    GoogleMapModel.DEFAULT_COORDINATE_LNG = 30.5238000;

    GoogleMapModel.ICON_TYPE_DEFAULT = 'Pin_Blue';
    GoogleMapModel.ICON_TYPE_BEST_PRICE = 'Pin_Green';
    GoogleMapModel.ICON_TYPE_RECENT_AND_BEST_PRICE = 'Pin_Light-green';
    GoogleMapModel.ICON_TYPE_RECENT = 'Pin_Light-blue';

    return GoogleMapModel;
});
