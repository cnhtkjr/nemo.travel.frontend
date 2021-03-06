define([
        'knockout',
        'js/vm/helpers',
        'js/vm/BaseControllerModel',
        'jsCookie',
        'js/vm/Models/HotelsBaseModel',
        'js/vm/Models/RecentHotelsModel',
        'js/vm/Models/LocalStorage'
    ],
    function (ko,
              helpers,
              BaseControllerModel,
              Cookie,
              HotelsBaseModel,
              RecentHotelsModel,
              LocalStorage
    ) {

        function HotelsSearchFormController(componentParameters) {

            BaseControllerModel.apply(this, arguments);

            var self = this;

            this.name = 'HotelsSearchFormController';

            this.maxInfants = 4;

            this.delayedSearch = true;
            this.searchError = ko.observable(false);
            this.segments = ko.observableArray([]);
            this.roomsFastSelectOptions = [];
            this.rooms = ko.observableArray();
            this.infantsAges = [];
            this.datesUnknown = ko.observable(false);
            this.options = {};
            this.validaTERROR = ko.observable(false);

            // Set cookies is not an observable for when it changes it won't trigger cookie setting via
            this.setCookies = false;
            this.useCookies = true;

            this.mode = HotelsBaseModel.MODE_NORMAL;
            this.roomsFastSelectorOpen = ko.observable(false);
            this.parametersChanged = ko.observable(false);
            this.showPreviousSearches = true;

            this.searchAllowedByParamChange = ko.computed(function () {
                return this.parametersChanged() || !this.forceChangeToSearch;
            }, this);

            this.searchEnabled = ko.computed(function () {
                return (!this.validaTERROR() || this.isValid()) && this.searchAllowedByParamChange();
            }, this);

            this.processInitParams();

            this.segments.subscribe(function () {
                this.recalcDateRestrictions();
            }, this);

            function infantsToi18n(value) {
                var key = 'passSummary_numeral_CLD_' + helpers.getNumeral(value, 'one', 'twoToFour', 'fourPlus');
                return self.$$controller.i18n('HotelsSearchForm', key);
            }

            // returns string like "16 взрослых, 9 детей в 4 номерах"
            function getSummaryGuests(rooms, guest) {

                var result = guest.adults + ' ' +
                    self.$$controller.i18n('HotelsSearchForm', 'passSummary_numeral_ADT_' +
                        helpers.getNumeral(guest.adults, 'one', 'twoToFour', 'fourPlus'));

                if (guest.infants === 0 && guest.adults === 1) {
                    return result;
                }

                if (guest.infants > 0) {
                    result += ', ' + guest.infants + ' ' + infantsToi18n(guest.infants);
                }

                result += ' ' + self.$$controller.i18n('HotelsSearchForm', 'hotels_in') + ' ' + rooms.length + ' ' +
                    self.$$controller.i18n('HotelsSearchForm', 'hotels_in_room_' +
                        helpers.getNumeral(rooms.length, 'one', 'more', 'more'));

                return result;
            }

            this.guestsSummary = ko.computed(function () {

                var guest = {adults: 0, infants: 0},
                    rooms = this.rooms();

                if (!rooms.length) {
                    return '';
                }

                rooms.forEach(function (room) {
                    guest.adults += room.adults();
                    guest.infants += room.infants().length;
                });

                return getSummaryGuests(rooms, guest);
            }, this);

            this.isValid = ko.computed(function () {
                var segments = this.segments(),
                    isValid = true;

                if (segments.length) {
                    isValid = segments[0].items.arrival.error() ||
                        segments[0].items.departureDate.error() ||
                        segments[0].items.arrivalDate.error();
                }

                return !isValid;
            }, this);

            this.cookieData = ko.computed(function () {

                var res = {
                        segments: [],
                        rooms: [],
                        datesUnknown: this.datesUnknown()
                    },
                    segments = this.segments(),
                    rooms = this.rooms();

                // Segments
                for (var i = 0; i < segments.length; i++) {
                    var segment = segments[i];
                    res.segments.push([
                        segment.items.arrival.value() ? segment.items.arrival.value().t : null,
                        segment.items.arrival.value() ? segment.items.arrival.value().id : null,
                        segment.items.arrivalDate.value() ? segment.items.arrivalDate.value().getISODate() : null,
                        segment.items.departureDate.value() ? segment.items.departureDate.value().getISODate() : null]);
                }

                // Rooms
                rooms.forEach(function (room) {
                    res.rooms.push({
                        adults: room.adults(),
                        infants: room.infants()
                    });
                });

                return res;
            }, this);

            this.cookieData.subscribe(function (newValue) {

                if (this.useCookies && this.setCookies) {
                    LocalStorage.set('searchFormData', newValue);
                } else {
                    this.$$controller.log('COOKIE NOT ENABED YET', this.getCookieName(), newValue);
                }
            }, this);
        }

        // Extending from dictionaryModel
        helpers.extendModel(HotelsSearchFormController, [BaseControllerModel]);
        // Inheritance override
        HotelsSearchFormController.prototype.cookieName = 'HotelsSearchForm';
        HotelsSearchFormController.prototype.$$i18nSegments = ['HotelsSearchForm'];
        HotelsSearchFormController.prototype.$$KOBindings = ['HotelsSearchForm'];
        HotelsSearchFormController.prototype.openRoomsSelector = function () {
            if (this.roomsUseExtendedSelect || this.roomsFastSelectOptions.length !== 0) {
                this.roomsFastSelectorOpen(!this.roomsFastSelectorOpen());
            }
        };
        HotelsSearchFormController.prototype.roomsTextForFastSelect = function (index) {

            var rooms = this.roomsFastSelectOptions[index].rooms,
                adults = this.roomsFastSelectOptions[index].adults;

            var result = adults + ' ' + this.$$controller.i18n('HotelsSearchForm', 'passSummary_numeral_ADT_' +
                    helpers.getNumeral(adults, 'one', 'twoToFour', 'fourPlus'));

            if (rooms && adults > 1) {
                result += ' ' +
                    this.$$controller.i18n(
                        'HotelsSearchForm',
                        'hotels_in'
                    ) +
                    ' ' +
                    rooms +
                    ' ' +
                    this.$$controller.i18n(
                        'HotelsSearchForm',
                        'hotels_in_room_' + helpers.getNumeral(
                            rooms,
                            'one',
                            'more',
                            'more'
                        )
                    );
            }

            return result;
        };
        HotelsSearchFormController.prototype.roomsSelectFast = function (index) {

            this.rooms();

            var rooms = [];

            if (this.roomsFastSelectOptions[index].rooms == 1) {
                rooms.push({
                    adults: ko.observable(this.roomsFastSelectOptions[index].adults),
                    infants: ko.observableArray([])
                });
            }
            else {
                var countRooms = this.roomsFastSelectOptions[index].rooms;
                for (var i = 0; i < countRooms; i++) {
                    rooms.push({
                        adults: ko.observable(1), infants: ko.observableArray([])
                    });
                }
            }
            this.rooms(rooms);
        };
        HotelsSearchFormController.prototype.getCookieName = function () {
            return this.$$controller.options.cookiesPrefix + this.cookieName;
        };

        HotelsSearchFormController.prototype.getSearchParams = function () {
            return LocalStorage.get('searchFormData');
        };

        HotelsSearchFormController.prototype.processInitParams = function () {

            var cookie = this.getSearchParams();

            if (cookie) {

                var hasSegments = cookie.segments && cookie.segments instanceof Array && cookie.segments.length > 0,
                    hasRooms = cookie.rooms && cookie.rooms instanceof Array && cookie.rooms.length > 0;

                // Checking cookie validity and fixing that
                if (hasSegments && hasRooms) {
                    this.$$controller.log('Initted by cookie', cookie);
                    this.preinittedData = cookie;
                    this.mode = HotelsBaseModel.MODE_PREINITTED;
                }
            }

            var additional = this.$$componentParameters.additional;

            if (additional) {
                this.showPreviousSearches = !!additional.showPreviousSearches;
            }
        };

        HotelsSearchFormController.prototype.recalcDateRestrictions = function () {
            var segments = this.segments(),
                prevdate,
                nextdate;

            this.dateRestrictions = [];
            for (var i = 0; i < segments.length; i++) {
                prevdate = this.options.dateOptions.minDate;
                nextdate = this.options.dateOptions.maxDate;

                if (segments[i].items.arrivalDate.value()) {
                    prevdate = segments[i].items.arrivalDate.value().dateObject();
                }

                if (segments[i].items.departureDate.value()) {
                    nextdate = segments[i].items.departureDate.value().dateObject();
                }

                if (prevdate.getTime() > nextdate.getTime()) {
                    nextdate = prevdate;

                    segments[i].items.departureDate.value(segments[i].items.arrivalDate.value());
                }

                this.dateRestrictions.push([prevdate, nextdate]);
            }
        };

        HotelsSearchFormController.prototype.getSegmentDateParameters = function (dateObj, index, isArrival) {
            var ret = {
                disabled: this.dateRestrictions[index][0] > dateObj || this.dateRestrictions[index][1] < dateObj,
                segments: [],
                period: true
            };
            var segments = ret.segments = this.segments();
            for (var i = 0; i < segments.length; i++) {
                if (segments[i].items.departureDate.value() && segments[i].items.arrivalDate.value()) {
                    var today = new Date();

                    if (isArrival && dateObj.getTime() >= today.getTime()) {
                        ret.disabled = false;
                    }

                    if (segments[i].items.arrivalDate.value().dateObject().getTime() <= dateObj.getTime()) {
                        ret.disabled = false;
                    }
                }
            }

            return ret;
        };

        /**
         * Submits search form
         */
        HotelsSearchFormController.prototype.startSearch = function () {

            this.searchError(false);

            if (!this.isValid()) {
                this.validaTERROR(true);
                this.processValidation();
            } else if (this.delayedSearch && this.$$controller.navigateGetPushStateSupport()) {
                RecentHotelsModel.clearRecent();
                this.$$controller.navigate('/hotels/results', true, 'HotelsResults');
            } else {
                var self = this;

                this.$$controller.log('STARTING SEARCH');
                self.searchError(false);
            }
        };

        HotelsSearchFormController.prototype.processValidation = function () {

            if (this.validaTERROR()) {

                var segments = this.segments();

                segments.forEach(function (segment) {
                    helpers.iterateObject(segment.items, function (item) {
                        if (item.error()) {
                            item.focus(true);
                            return true;
                        }
                    });
                });
            }
        };

        function processPreinittedMode(self) {
            
            for (var i = 0; i < self.preinittedData.segments.length; i++) {

                var segment = self.preinittedData.segments[i],
                    arrData = null;

                if (segment[1]) {
                    arrData = self.$$controller.getModel('Hotels/Common/Geo', {
                        data: {
                            t: segment[0],
                            id: segment[1]
                        },
                        guide: self.$$rawdata.guide
                    });
                }
                self.addSegment(
                    arrData,
                    segment[2] ? self.$$controller.getModel('Common/Date', segment[2]) : null,
                    segment[3] ? self.$$controller.getModel('Common/Date', segment[3]) : null
                );
            }

            // Add rooms from cookies
            for (i = 0; i < self.preinittedData.rooms.length; i++) {
                if (self.preinittedData.rooms[i].hasOwnProperty('adults')) {
                    self.rooms.push({
                        adults: ko.observable(self.preinittedData.rooms[i].adults),
                        infants: ko.observableArray(self.preinittedData.rooms[i].infants)
                    });
                }
            }

            self.datesUnknown(self.preinittedData.datesUnknown);
        }

        HotelsSearchFormController.prototype.buildModels = function () {

            var today = new Date();

            // Checking for errors
            if (this.$$rawdata.system && this.$$rawdata.system.error) {
                this.$$error(this.$$rawdata.system.error.message);

                return;
            }
            // Processing options
            // Passengers maximums
            this.options = this.$$rawdata.hotels.search.formData.maxLimits;
            this.options.totalPassengers = parseInt(this.options.totalPassengers, 10);

            this.roomsUseExtendedSelect = true;
            this.roomsFastSelectOptions = [
                {rooms: 1, adults: 1, infants: []},
                {rooms: 1, adults: 2, infants: []},
                {rooms: 1, adults: 3, infants: []},
                {rooms: 1, adults: 4, infants: []},
                {rooms: 2, adults: 2, infants: []}
            ];

            // Date options
            this.options.dateOptions = this.$$rawdata.hotels.search.formData.dateOptions;

            today.setHours(0, 0, 0, 0);
            this.options.dateOptions.minDate = new Date(today);

            this.options.dateOptions.minDate.setDate(
                this.options.dateOptions.minDate.getDate() + this.options.dateOptions.minOffset
            );

            this.options.dateOptions.maxDate = new Date(today);

            this.options.dateOptions.maxDate.setDate(
                this.options.dateOptions.maxDate.getDate() + this.options.dateOptions.maxOffset
            );

            // Processing segments
            if (this.mode === HotelsBaseModel.MODE_PREINITTED) {
                processPreinittedMode(this);
            }
            else {
                // Segments
                this.addSegment(null, null, null);

                // Rooms
                this.rooms([{
                    adults: ko.observable(1),
                    infants: ko.observableArray([])
                }]);
            }

            this.infantsAges = helpers.getAges();

            // All changes from now on will go to cookie
            this.setCookies = true;
            this.parametersChanged(false);
        };

        HotelsSearchFormController.prototype.addSegment = function (arrival, arrivalDate, departureDate) {
            this.segments.push(this.$$controller.getModel('Hotels/SearchForm/Segment', {
                arrival: arrival,
                arrivalDate: arrivalDate,
                departureDate: departureDate,
                index: this.segments().length,
                form: this
            }));
        };

        HotelsSearchFormController.prototype.$$usedModels = [
            'Hotels/SearchForm/Segment',
            'Common/Date',
            'Hotels/Common/Geo'
        ];

        HotelsSearchFormController.prototype.dataURL = function () {

            var url = '/hotels/search/formData/';

            if (this.$$rawdata) {
                return '';
            }

            return url;
        };

        HotelsSearchFormController.prototype.dataPOSTParameters = function () {

            var request = {},
                tmp = {};

            request.resources = {};

            if (this.mode === HotelsBaseModel.MODE_PREINITTED) {

                for (var i = 0; i < this.preinittedData.segments.length; i++) {
                    tmp[this.preinittedData.segments[i][0]] = this.preinittedData.segments[i][0];
                    tmp[this.preinittedData.segments[i][1]] = this.preinittedData.segments[i][1];
                }


                Object.keys(tmp).map(function (n) {
                    request.resources['guide/hotels/' + n] = {};
                    request.resources['guide/cities/' + n] = {};
                });
            }

            request.resources['system/info/currencyRates'] = {};

            request.resources = JSON.stringify(request.resources);

            return request;
        };

        HotelsSearchFormController.prototype.roomAdd = function () {
            this.rooms.push({
                adults: ko.observable(1),
                infants: ko.observableArray([])
            });
        };

        HotelsSearchFormController.prototype.roomRemove = function (index) {
            this.rooms.splice(index, 1);
        };

        HotelsSearchFormController.prototype.selectInfantAge = function (room, infant, age) {
            this.rooms()[room].infants()[infant] = age;

            this.rooms.valueHasMutated();
        };

        HotelsSearchFormController.prototype.pageTitle = null;

        return HotelsSearchFormController;
    });
