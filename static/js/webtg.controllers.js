'use strict';

var webtgControllers = angular.module('webtgControllers', []);

webtgControllers.controller('MainCtrl', [
  '$scope', '$location', '$window', '$interval', 'socket', '$log',
  function($scope, $location, $window, $interval, socket, $log){
    $scope.$location = $location;

    // debugging aids
    $window.socket = socket;
    $window.$scope = $scope;

    // globals
    $scope.username = null;
    $scope.conversations = [];
    $scope.current_conversation = {};
    $scope.newmessage = {to: '', content: ''};

    // event handlers
    $scope.$on('connection',function(evt,state){
      $scope.connection_state = state;
    });
    $scope.$on('session.state',function(evt,data){
      if(data.status=='connected'){
        $scope.username = data.username;
        $scope.conversationsList();
        $interval($scope.statusOnline, 30000);
      }else if(data.status=='not authenticated'){
        $scope.username = '';
        $window.location = '/login';
      }
    });
    $scope.$on('telegram.dialog_list',function(evt,data){
      $scope.conversations = data.contents;
      $scope.validateCurrentConversation();
    });
    $scope.$on('telegram.history',function(evt,data){
      $scope.setMessages(data.extra, data.contents);
    });
    $scope.$on('telegram.message',function(evt,data){
      // normalize data, to make message obj compatible with history
      data.from = data.sender;
      data.to   = data.receiver;
      data.out  = data.own;
      if(!data.peer){ data.peer = data.own ? data.receiver : data.sender; }
      $scope.setMessages(data.peer, [data]);
    });

    // telegram commands
    $scope.statusOnline = function(){
      socket.send({ 'event': 'telegram.status_online' });
    };
    $scope.conversationsList = function(){
      socket.send({ 'event': 'telegram.dialog_list' });
    };
    $scope.conversationHistory = function(){
      socket.send({
        event: 'telegram.history',
        args:  [ $scope.current_conversation.print_name ],
        extra: $scope.current_conversation
      });
    };
    $scope.sendMessage = function(){
      socket.send({
        event: 'telegram.msg',
        args:  [ $scope.newmessage.to, $scope.newmessage.content ],
      });
      $scope.newmessage.content = '';
    };

    // controller functions
    $scope.setConversation = function(conversation, set_to){
      if($scope.current_conversation.id != conversation.id){
        $scope.current_conversation = conversation;
        $scope.conversationHistory();
      }
      if(set_to!==false){
        $scope.newmessage.to = conversation.print_name ? conversation.print_name : conversation.cmd;
      }
    };
    $scope.clearConversation = function(){
      $scope.current_conversation = {};
      $scope.newmessage.to = '';
    };
    $scope.validateCurrentConversation = function(){
      var conversation={};
      if($scope.conversations.length){
        if($scope.current_conversation.id){
          angular.forEach($scope.conversations, function(v,k){ if(v.id==$scope.current_conversation.id) conversation=v; });
        }
        if(!conversation.id){ conversation = $scope.conversations[0]; }
        $scope.setConversation(conversation);
      }else{
        $scope.clearConversation();
      }
    };
    $scope.setMessages = function(conversation, messages){
      var c={};
      angular.forEach($scope.conversations, function(v,k){ if(v.id==conversation.id) c=v; });
      if(!c.id){
        c=conversation;
        $scope.conversationsList();
      }
      if(!c.messages){ c.messages = []; }
      var trackDuplicates = {};
      angular.forEach(c.messages, function(v,k){ this[v.id] = k; }, trackDuplicates);
      angular.forEach(messages, function(v,k){
        if(trackDuplicates[v.id] === undefined){
          trackDuplicates[v.id] = this.push.length;
          if(v.text){ v.text = emojione.toImage(v.text); }
          this.push(v);
        }
      }, c.messages);
      $scope.setConversation(c);
    };
    // Start communication
    socket.start();
  }
]);

webtgControllers.controller('MessagesCtrl', [
  '$scope', 'socket', '$log',
  function($scope, socket, $log){

  }
]);

webtgControllers.controller('ContactsCtrl', [
  '$scope', 'socket', '$log',
  function($scope, socket, $log){

  }
]);
