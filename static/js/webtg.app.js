'use strict';

var webtg = angular.module('webTg', [
  'ngRoute',
  'ui.bootstrap',
  'ngSanitize',
  'webtgServices',
  'webtgControllers',
]);

webtg.config(['$routeProvider', function($routeProvider) {
  $routeProvider.
    when('/messages', {
      templateUrl: '/static/pages/messages.html',
      controller: 'MessagesCtrl'
    }).
    when('/contacts', {
      templateUrl: '/static/pages/contacts.html',
      controller: 'ContactsCtrl'
    }).
    otherwise({
      redirectTo: '/messages'
    });
}]);
