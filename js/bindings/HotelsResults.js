define(
    ['knockout', 'jquery', 'jsCookie', 'js/vm/Models/SliderViewModel', 'js/vm/helpers', 'jqueryUI', 'js/lib/jquery.mousewheel/jquery.mousewheel.min'],
    function (ko, $, Cookie, SliderViewModel, helpers) {
        // HotelsResults Knockout bindings are defined here
        /*
         ko.bindingHandlers.testBinding = {
         init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {},
         update: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {}
         };

         // Do not forget to add destroy callbacks
         ko.utils.domNodeDisposal.addDisposeCallback(element, function() {});
         */
        ko.bindingHandlers.commonPostFiltersBindings = {
            init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {

                $(element).addClass("js-common-sticker");
                $(element).addClass("nemo-common-sticker");

                $(element).children().wrapAll("<div class='nemo-common-sticker__inner js-common-sticker__inner'></div>");

                var scrolled, initialPosition = 0;
                var sticker = $(element);
                var stickerInner = sticker.children(".js-common-sticker__inner");
                var margin = 20;

                stickerInner.css("top", margin + "px");
                stickerInner.css("height", $(window).height() - initialPosition - 2 * margin + "px");

                $(element).mousewheel(function () {
                    stickyRedraw();
                });

                $(element).on("click", function () {
                    stickyRedraw();
                });


                $(window).on("resize", function () {
                    stickyRedraw();
                    // setMapDivSize();
                });

                $(document).scroll(function (event) {
                    stickyRedraw();
                });

                function stickyRedraw() {

                    // Setting default height of sticker by the height of the window.
                    // stickerInner.css("height", $(window).height() + "px");

                    initialPosition = $(element).offset().top;
                    scrolled = $(document).scrollTop();

                    if ((scrolled + $(window).height() - initialPosition) > $(element).height()) {
                        stickerInner.css("top", '');
                        stickerInner.css("bottom", margin + 'px');

                        if (scrolled < initialPosition) {
                            stickerInner.css("height", $(element).height() - 2 * margin + "px");
                        } else {
                            stickerInner.css("height", initialPosition + $(element).height() - scrolled - 2 * margin + "px");
                        }

                    } else {

                        stickerInner.css("bottom", '');

                        if (scrolled > initialPosition) {
                            stickerInner.css("top", scrolled - initialPosition + margin + "px");
                            stickerInner.css("height", $(window).height() - 2 * margin + "px");
                        } else {
                            stickerInner.css("top", margin + "px");
                            stickerInner.css("height", $(window).height() - initialPosition + scrolled - 2 * margin + "px");
                        }

                    }
                }

            },
            update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {

            }
        };

        ko.bindingHandlers.hotelsResultsAdaptivePF = {
            init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                function closePF(e) {
                    if (
                        $(e.target).closest('.js-flights-results__adaptiveFiltersNoClose').length == 0
                    ) {
                        valueAccessor()(false);
                    }
                }

                $('body')
                    .addClass('nemo-flights-results__adaptivePF')
                    .on('click', closePF);

                ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
                    $('body')
                        .removeClass('nemo-flights-results__adaptivePF')
                        .off('click', closePF);
                });
            }
        };


        /* insert bindings */

        ko.bindingHandlers.hotelsResultsDescriptionBindings = {
            update: function (element, valueAccessor, allBindings) {
                setTimeout(function () {
                    $(element).dotdotdot({
                        watch: 'window'
                    });
                }, 1);
            }
        };

        ko.bindingHandlers.hotelsResultsDescriptionBindingsTags = {
            update: function (element, valueAccessor, allBindings) {

                var $description = $(valueAccessor()),
                    text = [];

                $description.each(function (index, el) {
                    text.push($(el).text());
                });

                $(element).html(text.join('<br>'));

                setTimeout(function () {
                    $(element).dotdotdot({
                        watch: 'window'
                    });
                }, 100);
            }
        };

        ko.bindingHandlers.slider = {
            init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {

                var vm = viewModel;
                var $element = $(element);

                $element.slider({
                    range: vm.type === SliderViewModel.TYPE_RANGE || vm.type,
                    min: vm.initialMin,
                    max: vm.initialMax,
                    values: vm.type == SliderViewModel.TYPE_RANGE ? [vm.initialMin, vm.initialMax] : vm.initialMax,

                    slide: function (event, ui) {
                        if (vm.type === SliderViewModel.TYPE_RANGE) {
                            vm.displayRangeMin(ui.values[0]);
                            vm.displayRangeMax(ui.values[1]);
                        }
                        else if (vm.type == SliderViewModel.TYPE_MIN) {
                            vm.displayRangeMin(ui.value);
                        }
                    },

                    change: function (event, ui) {
                        if (event.originalEvent) {
                            if (vm.type === SliderViewModel.TYPE_RANGE) {
                                vm.rangeMin(ui.values[0]);
                                vm.rangeMax(ui.values[1]);
                            }
                            else if (vm.type === SliderViewModel.TYPE_MIN) {
                                vm.rangeMin(ui.value);
                            }

                            if (bindingContext.$parent.dummyObservalbe) {
                                bindingContext.$parent.dummyObservalbe.notifySubscribers();
                            }

                            if (bindingContext.$parent.filters) {
                                bindingContext.$parent.filters.dummyObservalbe.notifySubscribers();
                            }
                        }
                    }
                });

                // Do not forget to add destroy callbacks
                ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
                    try {
                        $element.slider('destroy');
                    } catch (e) {}
                });
            },

            update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {

                var vm = viewModel,
                    min = vm.rangeMin(),
                    max = vm.rangeMax(),
                    key,
                    value;

                if (min < max) {
                    key = vm.type === SliderViewModel.TYPE_RANGE ? 'values' : 'value';
                    value = vm.type === SliderViewModel.TYPE_RANGE ? [min, max] : min;
                } else {
                    key = vm.type === SliderViewModel.TYPE_RANGE ? 'values' : 'value';
                    value = vm.type === SliderViewModel.TYPE_RANGE ? [min - 1, max] : min;
                }

                $(element).slider(key, value);
            }
        };

        /* end insert bindings */

        ko.bindingHandlers.hotelsResultsSearchFormHider = {
            init: function (element, valueAccessor) {

                function hide(e) {

                    var $this = $(e.target),
                        hideForm = $this.closest('body').length > 0 &&
                            $this.closest('.nemo-hotels-form, .nemo-hotels-form__formContainer').length == 0 && // is not search form
                            $this.closest('.ui-widget,.ui-dialog__wrapper,.js-nemo-pmu,.js-flights-results__formOpener,.js-flights-results__form').length == 0, // is not calendar form
                        formIsVisible = valueAccessor()() === true;

                    if (formIsVisible && hideForm) {
                        valueAccessor()(false); // hide form
                    }
                }

                $('body').on('click', hide);

                ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
                    $('body').off('click', hide)
                });
            }
        };

        /**
         * Displays formatted money value depends on user currency
         */
        ko.bindingHandlers.money = {
            update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {

                var $moneyElement = $(element),
                    money = valueAccessor(),
                    currency = allBindingsAccessor().currency, // initial currency
                    convertedValue = 0;

                if (money) {

                    var agency = bindingContext.$root.agency,
                        userCurrency = agency.userCurrency(),
                        rates = agency.rates();

                    convertedValue = helpers.convertMoney(money, currency, userCurrency, rates); // converts money to user currency
                }

                var formattedMoney = helpers.toMoney(convertedValue);

                $moneyElement.text(formattedMoney);
            }
        };

        ko.bindingHandlers.userCurrency = {
            init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {},
            update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {

                var userCurrencyId = bindingContext.$root.agency.userCurrency(),
                    currencyIcon  = bindingContext.$root.i18n('currencyNames', 'currency_' + userCurrencyId + '_s');

                $(element).text(currencyIcon).attr('data-currency', userCurrencyId.toLowerCase());
            }
        };

        ko.bindingHandlers.dotdotdot = {
            update: function (element, valueAccessor, allBindings) {

                var applyDotDotDot = valueAccessor(),
                    isApplied = $(element).triggerHandler('isTruncated');

                if (applyDotDotDot && !isApplied) {
                    $(element).dotdotdot({
                        height: 40
                    });
                } else if (isApplied && !applyDotDotDot) {
                    $(element).trigger('destroy.dot');
                }
            }
        };
    }
);
