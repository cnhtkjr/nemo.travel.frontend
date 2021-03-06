define([
    'knockout',
    'js/vm/helpers',
    'js/vm/Models/HotelsFiltersViewModel',
    'js/vm/Models/SliderViewModel',
    'js/vm/Models/BreadcrumbViewModel',
    'js/vm/Models/HotelsBaseModel',
    'js/vm/Models/GoogleMapModel',
    'js/vm/Models/RecentSearchModel',
    'js/vm/Models/LocalStorage'
], function (ko,
             helpers,
             HotelsFiltersViewModel,
             SliderViewModel,
             BreadcrumbViewModel,
             HotelsBaseModel,
             GoogleMapModel,
             RecentSearchModel,
             LocalStorage
) {

    function HotelSearchResultsModel() {

    }

    helpers.extendModel(HotelSearchResultsModel, [HotelsBaseModel, GoogleMapModel]);

    HotelSearchResultsModel.prototype.processInitParams = function () {
        this.mode = HotelsBaseModel.MODE_SEARCH;
        this.searchInfo(LocalStorage.get('searchFormData'));
    };

    /**
     * Returns modified data entered by user in search form
     * @returns {Object}
     */
    HotelSearchResultsModel.prototype.prepareRequestData = function () {

        var requestData = {},
            rooms = [],
            localStorageFormData = LocalStorage.get('searchFormData'),
            segment = localStorageFormData.segments[0];

        var KEY_CITY_ID = 1,
            KEY_CHECK_IN_DATE = 2,
            KEY_CHECK_OUT_DATE = 3;

        localStorageFormData.rooms.forEach(function (room, i) {

            if (!rooms[i]) {
                rooms[i] = {};
            }

            rooms[i].ADT = room.adults;

            if (room.infants.length) {

                rooms[i].CLD = room.infants.length;

                for (var indexInfants = 0; indexInfants < room.infants.length; indexInfants++) {
                    if (!rooms[i].childAges) {
                        rooms[i].childAges = [];
                    }
                    rooms[i].childAges.push(room.infants[indexInfants]);
                }
            }

        });

        requestData.request = JSON.stringify({
            cityId: segment[KEY_CITY_ID],
            checkInDate: helpers.ISODateString(new Date(segment[KEY_CHECK_IN_DATE])),
            checkOutDate: helpers.ISODateString(new Date(segment[KEY_CHECK_OUT_DATE])),
            isDelayed: false,
            rooms: rooms
        });

        return requestData;
    };

    HotelSearchResultsModel.prototype.buildModels = function () {

        var self = this;

        function searchError(code, systemData) {

            self.fillSearchForm();

            if (typeof systemData !== 'undefined' && systemData[0] !== 0) {
                self.$$controller.error('SEARCH ERROR: ' + code, systemData);
            }

            if (typeof systemData === 'undefined' || systemData[0] !== 0) {
                self.errorCode(code);
            }
        }

        var onSuccess = function (json) {

            try {

                var response = JSON.parse(json),
                    responseErrorCode = null,
                    error;

                self.$$rawdata = response;

                if (response.system && response.system.error) {
                    responseErrorCode = response.system.error.code;
                    error = response.system.error;
                } else if (!self.$$rawdata.hotels.staticDataInfo.hotels) {
                    responseErrorCode = '404';
                } else if (response.hotels.search.results.info.errorCode) {
                    responseErrorCode = response.hotels.search.results.info.errorCode;
                }

                if (responseErrorCode) {
                    searchError(responseErrorCode, error);
                    return;
                }

                var searchId = response.hotels.search.results.id,
                    hotelId = self.$$controller.router.current.getParameterValue('hotel_id'),
                    newUrl = '/hotels/results/' + searchId;

                if (hotelId) {
                    newUrl += '/' + hotelId;
                }

                self.$$controller.router.replaceState(newUrl, self.$$controller.i18n('pageTitles', 'HotelsResults'));

                LocalStorage.set('searchFormData', self.createCookieParamsFromResponse(self.$$rawdata.hotels.search.request));
                self.processSearchResults();

            } catch (e) {
                console.error(e);
            }
        };

        var searchId = this.$$controller.router.current.getParameterValue('search_id'),
            url = searchId ? ('/hotels/search/results/' + searchId) : '/hotels/search/request',
            postData = searchId ? {} : this.prepareRequestData();

        this.$$controller.loadData(url, postData, onSuccess);
    };

    /**
     * Returns total price of hotels include all rooms by cheapest tariff
     * @param hotel
     * @returns {number}
     */
    HotelSearchResultsModel.prototype.getFirstRoomsPrice = function (hotel) {

        var price = 0;

        hotel.rooms.forEach(function (tariffs) {
            price += tariffs[0].rate.price.amount;
        });

        return price;
    };

    /**
     * Get distance from center and airport
     * @param hotel
     * @returns {string[]} first element is distance from center, second is distance from airport
     */
    HotelSearchResultsModel.prototype.getDistances = function (hotel) {

        var TYPE_NAME_CENTER = 'Center',
            TYPE_NAME_AIRPORT = 'Airport',
            distances = ['', ''];

        /**
         *
         * @param {Object} distanceData
         * @param {Number} distanceData.distance
         * @param {String} distanceData.measurement
         * @param {String} distanceData.transportType
         * @returns {String}
         */
        var getDistance = function (distanceData) {

            var res = '';

            if (distanceData) {
                res = distanceData.distance + ' ' + distanceData.measurement;
            }

            return res;
        };

        // iterate over all existing distances and check is there distance to the center or an airport
        helpers.iterateObject(hotel.staticDataInfo.distancesOriginal, function (distance, typeName) {

            if (distance.distancesArray && distance.distancesArray.length > 0) {
                if (typeName === TYPE_NAME_CENTER) {
                    distances[0] = getDistance(distance.distancesArray[0].value);
                } else if (typeName === TYPE_NAME_AIRPORT) {
                    distances[1] = getDistance(distance.distancesArray[0].value);
                }
            }
        });

        return distances;
    };

    function compareObjects(firstArray, secondArray, propertyFirst, propertySecond) {

        var data = secondArray.slice(0);

        firstArray.forEach(function (firstArrayValue, firstArrayIndex, arrFirst) {
            secondArray.forEach(function (secondArrayValue, secondArrayIndex) {
                if (firstArrayValue.id === secondArrayValue[propertyFirst]) {
                    data[secondArrayIndex][propertySecond] = arrFirst[firstArrayIndex];
                }
            });
        });

        return data;
    }

    /**
     * Makes associations "room id" to "room"
     * @param roomsGroup
     * @returns {{}}
     */
    function createRoomsDictionary(roomsGroup) {

        var rooms = {};

        roomsGroup.forEach(function (itemGroup) {
            if (itemGroup.id || itemGroup.id === 0) {
                rooms[itemGroup.id] = itemGroup;
            }
        });

        return rooms;
    }

    function createStarsArray(starRating) {

        var starRatingArr = [];

        for (var indexStar = 0; indexStar < starRating; indexStar++) {
            starRatingArr.push('1');
        }

        return starRatingArr;
    }

    function getPromotionalHotels(allHotels, promotionalHotels) {

        promotionalHotels = promotionalHotels || [];

        var existingHotels = allHotels.filter(function (item) {
            return promotionalHotels.indexOf(item.id) > -1;
        });

        // get first 2 hotels;
        return existingHotels.slice(0, 2);
    }

    function addHotelsRooms(results) {

        var hotels = [],
            roomsDictionary = createRoomsDictionary(results.roomsGroup);

        // running through all hotels in search results
        helpers.iterateObject(results.hotels, function (hotel) {

            var rooms = [];

            // rooms in a hotel
            hotel.roomGroups.forEach(function (room) {

                var roomTariffs = [];

                // room variants
                room.roomVariants.forEach(function (roomId) {
                    roomTariffs.push(roomsDictionary[roomId]);
                });

                rooms[room.searchRoomId] = roomTariffs
            });

            // create properties which include data about rooms
            hotel.rooms = rooms;

            //create array with hotels,static data and rooms
            hotels.push(hotel);
        });

        return hotels;
    }

    HotelSearchResultsModel.prototype.processSearchResults = function () {

        var self = this,
            searchData = this.$$rawdata.hotels.search ? this.$$rawdata.hotels.search : null,
            staticData = this.$$rawdata.hotels.staticDataInfo ? this.$$rawdata.hotels.staticDataInfo : null,
            minHotelPrice = Infinity,
            maxHotelPrice = -Infinity,
            MILLISECONDS_IN_DAY = 86400000;

        self.cheapestHotel = null;

        this.searchId(searchData && searchData.request ? searchData.request.id : '');

        searchData.results.roomsGroup = compareObjects(searchData.results.roomMeals, searchData.results.roomsGroup, 'mealId', 'meal');
        searchData.results.roomsGroup = compareObjects(searchData.results.roomRates, searchData.results.roomsGroup, 'rateId', 'rate');
        searchData.results.roomsGroup = compareObjects(searchData.results.roomTypes, searchData.results.roomsGroup, 'typeId', 'type');

        // adding `staticDataInfo` to hotel with identical id
        staticData.hotels.forEach(function (hotel) {
            if (searchData.results.hotels[hotel.id]) {
                searchData.results.hotels[hotel.id].staticDataInfo = hotel;
            }
        });

        // find hotel with cheapest price
        function findCheapestHotel(hotel) {
            if (hotel.hotelPrice < minHotelPrice) {
                minHotelPrice = hotel.hotelPrice;
                self.cheapestHotel = hotel;
            }
        }

        // find hotel with max price
        function findMostExpensiveHotel(hotel) {
            if (hotel.hotelPrice > maxHotelPrice) {
                maxHotelPrice = hotel.hotelPrice;
            }
        }

        var hotels = addHotelsRooms(searchData.results);

        hotels.forEach(function (hotel) {

            hotel.staticDataInfo.featuresArray = [];

            helpers.iterateObject(hotel.staticDataInfo.features, function (feature, id) {
                feature.id = id;
                hotel.staticDataInfo.featuresArray.push(feature);
            });

            hotel.staticDataInfo.starRating = createStarsArray(hotel.staticDataInfo.starRating);
            hotel.staticDataInfo.distancesOriginal = hotel.staticDataInfo.distances;
            hotel.staticDataInfo.distances = helpers.toArray(hotel.staticDataInfo.distances || {});

            hotel.hotelPriceOriginal = self.getFirstRoomsPrice(hotel);
            hotel.hotelPrice = Math.round(hotel.hotelPriceOriginal);

            findCheapestHotel(hotel);
            findMostExpensiveHotel(hotel);

            if (!hotel.averageCustomerRating) {
                hotel.averageCustomerRating = {
                    value: 0,
                    description: ''
                };
            }
        });

        this.currentCity(staticData.cities[0].name);
        this.hotels = ko.observableArray(hotels);
        this.recentViewedHotels = ko.observableArray([]);

        this.promotionalHotels = ko.observableArray(
            getPromotionalHotels(hotels, self.$$rawdata.hotels.search.resultData.promotionalHotels)
        );

        // nights count between dates entered in search form
        this.countOfNights = ko.observable(
            Math.floor((new Date(searchData.request.checkOutDate) - new Date(searchData.request.checkInDate)) / MILLISECONDS_IN_DAY)
        );

        this.filters = new HotelsFiltersViewModel(ko, minHotelPrice, maxHotelPrice);

        /**
         * Returns sorted hotels
         */
        this.getSortedHotels = ko.computed(function () {

            self.filters.dummyObservalbe();

            /**
             * Sorts hotels by rating (from max rating to min rating)
             * @param currentElement
             * @param nextElement
             * @returns {number}
             */
            var sortHotelsByPopular = function (currentElement, nextElement) {

                var currentElementRating = currentElement.staticDataInfo.averageCustomerRating,
                    nextElementRating = nextElement.staticDataInfo.averageCustomerRating;

                if (!currentElementRating) {
                    return 1;
                }

                if (!nextElementRating) {
                    return -1;
                }

                return currentElementRating.value > nextElementRating.value ? -1 : 1;
            };

            /**
             * Sorts hotels by price (from min price to max price)
             * @param currentElement
             * @param nextElement
             * @returns {number}
             */
            var sortHotelsByPrice = function (currentElement, nextElement) {
                return currentElement.hotelPrice > nextElement.hotelPrice ? 1 : -1;
            };

            if (self.filters.sortType() === HotelsBaseModel.SORT_TYPES.BY_PRICE) {
                return self.hotels().sort(sortHotelsByPrice);
            }

            if (self.filters.sortType() === HotelsBaseModel.SORT_TYPES.BY_POPULAR) {
                return self.hotels().sort(sortHotelsByPopular);
            }

            return self.hotels();
        });

        /**
         * Returns array of hotels filtered by stars, features, price, and sorting
         * @return {Array}
         */
        this.getFilteredAndSortedHotels = ko.computed(function () {

            // if any of filters weren't applied will return all hotels
            if (self.filters.isFilterEmpty()) {
                return self.getSortedHotels();
            }

            return ko.utils.arrayFilter(self.getSortedHotels(), function (hotel) {
                return self.filters.isMatchWithAllFilters(hotel);
            });
        });

        this.exceptStarFilteredHotels = ko.computed(function () {

            if (self.filters.isFilterEmpty()) {
                return self.getSortedHotels();
            }

            return ko.utils.arrayFilter(self.getSortedHotels(), function (hotel) {
                return self.filters.isMatchWithAllFiltersExcept(hotel, HotelsFiltersViewModel.FILTER_TYPE_STARS);
            });
        });

        this.getHotelsExceptFeatureFilter = ko.computed(function () {

            if (self.filters.isFilterEmpty()) {
                return self.getSortedHotels();
            }

            return ko.utils.arrayFilter(self.getSortedHotels(), function (hotel) {
                return self.filters.isMatchWithAllFiltersExcept(hotel, HotelsFiltersViewModel.FILTER_TYPE_FEATURE);
            });
        });

        /**
         * Returns array of hotels which will be displayed to user (depends on filters, lazy load)
         */
        this.slicedFilteredHotels = ko.computed(function () {
            return self.getFilteredAndSortedHotels().slice(0, self.visibleHotelsCount());
        });

        this.distanceFromCenter = new SliderViewModel(
            ko,
            SliderViewModel.TYPE_MIN,
            GoogleMapModel.MAP_DISTANCE_MIN,
            GoogleMapModel.MAP_DISTANCE_MAX
        );

        this.isResultEmpty = ko.computed(function () {
            return !self.filters.isFilterEmpty() && self.getFilteredAndSortedHotels().length === 0;
        });

        function updateMapMarkers(hotels) {

            var METERS_PER_ONE_KILOMETER = 1000;

            if (self.circle) {
                self.circle.setRadius(self.distanceFromCenter.rangeMin() * METERS_PER_ONE_KILOMETER); // sets radius in meters
            }

            var bounds = self.addMarkersOnMap(hotels);

            if (bounds) {
                self.maps['map'].fitBounds(bounds);
                self.maps['map'].panToBounds(bounds);
            }
        }

        // hotels shown on google map in circle
        this.inCircleFilteredHotels = ko.computed(function () {

            self.filters.dummyObservalbe();

            var minPrice = Infinity,
                index = 0,
                minPriceHotelIndex = 0;

            var hotels = ko.utils.arrayFilter(self.getFilteredAndSortedHotels(), function (hotel) {

                hotel.staticDataInfo.isBestPrice = false;

                var showHotel = hotel.distanceFromCenter <= self.distanceFromCenter.rangeMin();

                if (showHotel) {

                    if (hotel.hotelPrice < minPrice) {
                        minPrice = hotel.hotelPrice;
                        minPriceHotelIndex = index;
                    }

                    index++;
                }

                return showHotel;
            });

            if (hotels[minPriceHotelIndex]) {
                hotels[minPriceHotelIndex].staticDataInfo.isBestPrice = true;
            }

            return hotels;
        });

        this.inCircleFilteredHotels.subscribe(function (hotels) {
            updateMapMarkers(hotels);
        });

        /**
         * Returns minimal hotel price by stars
         * @return {Array}
         */
        this.minStarPrices = ko.computed(function () {

            var minPrices = [],
                hotels = self.exceptStarFilteredHotels();

            for (var star = 0; star <= HotelsFiltersViewModel.STARS_MAX_COUNT; star++) {
                minPrices[star] = 0;
            }

            hotels.forEach(function (hotel) {

                var hotelStar = hotel.staticDataInfo.starRating ? hotel.staticDataInfo.starRating.length : 0,
                    price = hotel.hotelPrice;

                if (!minPrices[hotelStar] || minPrices[hotelStar] > price) {
                    minPrices[hotelStar] = price;
                }

            });

            return minPrices;
        });

        /**
         * Returns summary hotels count of each feature
         * @return {Object}
         */
        this.featuresCount = ko.computed(function () {

            var self = this,
                featureFilterValues = {},
                hotels = self.getHotelsExceptFeatureFilter();

            hotels.forEach(function (hotel) {

                var hotelServices = hotel.staticDataInfo.popularFeatures || [];

                hotelServices.forEach(function (feature) {

                    if (!featureFilterValues[feature]) {
                        featureFilterValues[feature] = {
                            id: feature,
                            name: self.$$rawdata.hotels.staticDataInfo.popularHotelsFeatures[feature],
                            count: 0
                        };
                    }

                    featureFilterValues[feature].count++;
                });
            });

            this.filters.featureFilter.setFilterValues(featureFilterValues);

        }, this);

        this.initialMinStarPrices = this.minStarPrices();

        /**
         * Returns hotels count what can be loaded with lazy loading
         * @return {Number}
         */
        this.lazyLoadHotelsCount = ko.computed(function () {

            var hiddenHotelsCount = self.getFilteredAndSortedHotels().length - self.visibleHotelsCount();

            return Math.min(
                Math.max(hiddenHotelsCount, 0),
                HotelsBaseModel.MAX_HOTELS_COUNT_WHAT_CAN_BE_LOADED_WITH_LAZY_LOADING
            );
        });

        this.hideShowMoreButton = ko.computed(function () {
            return self.lazyLoadHotelsCount() === 0;
        });

        this.showNextHotels = function () {
            self.visibleHotelsCount(self.visibleHotelsCount() + self.lazyLoadHotelsCount());
        };

        function getMinAndMaxPriceOrArrayOfHotels(hotels) {

            var minPrice = Infinity,
                maxPrice = -Infinity;

            hotels.forEach(function (hotel) {

                if (hotel.hotelPrice < minPrice) {
                    minPrice = hotel.hotelPrice;
                }

                if (hotel.hotelPrice > maxPrice) {
                    maxPrice = hotel.hotelPrice;
                }

            });

            return [minPrice, maxPrice];
        }

        // returns string like "Еще 25 вариантов (от 16 700 до 28 000 р)"
        this.showNextHotelsButtonText = ko.computed(function () {

            var lazyLoadHotelsCount = self.lazyLoadHotelsCount(),
                filteredAndSortedHotels = this.getFilteredAndSortedHotels(),
                willLoadThisHotels = [];

            for (var i = self.visibleHotelsCount(); i < (self.visibleHotelsCount() + lazyLoadHotelsCount); i++) {
                willLoadThisHotels.push(filteredAndSortedHotels[i]);
            }

            var prices = getMinAndMaxPriceOrArrayOfHotels(willLoadThisHotels);

            function toMoney(price) {
                return helpers.toMoney(helpers.convertMoney(price, 'EUR', self.$$controller.viewModel.agency.userCurrency(), self.$$controller.viewModel.agency.rates()));
            }

            return this.$$controller.i18n('HotelsSearchResults', 'showAlsoVariants', {
                value: lazyLoadHotelsCount,
                variants: this.$$controller.i18n('HotelsSearchResults', 'variants_' + helpers.getNumeral(lazyLoadHotelsCount, 'one', 'twoToFour', 'fourPlus')),
                price1: toMoney(prices[0]),
                price2: toMoney(prices[1]),
                currency: this.$$controller.i18n('currencyNames', 'currency_' + this.$$controller.viewModel.agency.userCurrency() + '_s')
            });
        }, this);

        // returns string like "ночь", "ночи", "ночей"
        this.labelAfterNights = ko.computed(function () {
            return self.$$controller.i18n(
                'HotelsSearchResults',
                'PH__label_after_nights_' + helpers.getNumeral(self.countOfNights(), 'one', 'two_to_four', 'more_than_five')
            );
        });

        // returns string like "Цена за 28 ночей"
        this.displayCountOfNightsPrice = ko.computed(function () {
            return self.$$controller.i18n('HotelsSearchResults', 'PF__filter__price_part') + ' ' + self.countOfNights() + ' ' + self.labelAfterNights();
        });

        if (typeof this.$$rawdata.system !== 'undefined' && typeof this.$$rawdata.system.error !== 'undefined') {
            this.$$error(this.$$rawdata.system.error.message);
        } else {
            // Processing options
            this.options = this.$$rawdata.hotels.search.resultData;
        }

        this.fillSearchForm();

        this.breadCrumbsVariants.notifySubscribers();

        this.resultsLoaded(true);

        function getHotelById(id) {

            var hotels = self.hotels(),
                res = null;

            hotels.forEach(function (hotel) {
                if (hotel.id === id) {
                    res = hotel;
                    return;
                }
            });

            return res
        }

        var hotelId = self.$$controller.router.current.getParameterValue('hotel_id');

        if (hotelId) {
            self.showCardHotel(getHotelById(hotelId));
        }
    };

    HotelSearchResultsModel.prototype.fillSearchForm = function () {

        var staticDataInfo = this.$$rawdata.hotels && this.$$rawdata.hotels.staticDataInfo ? this.$$rawdata.hotels.staticDataInfo : {},
            searchInfo;

        if (this.$$rawdata.hotels && this.$$rawdata.hotels.search && this.$$rawdata.hotels.search.request) {
            searchInfo = this.createCookieParamsFromResponse(this.$$rawdata.hotels.search.request);
        } else {
            searchInfo = LocalStorage.get('searchFormData');
        }

        var form = this.searchForm = new BreadcrumbViewModel(searchInfo, this.$$controller, staticDataInfo);

        if (this.$$controller.router.current.getParameterValue('search_id')) {
            RecentSearchModel.add(this.$$controller.router.current.getParameterValue('search_id'), {
                title: form.city.name + ' (' + form.city.country + '), ' +
                form.arrivalDate.getFullDate() + ' - ' + form.departureDate.getFullDate()
            });
        }
    };

    HotelSearchResultsModel.prototype.$$usedModels = [
        'Common/Date',
        'Common/Duration',
        'Common/Money',
        'Common/PostFilter/Abstract',
        'Hotels/Common/Geo'
    ];

    return HotelSearchResultsModel;
});
