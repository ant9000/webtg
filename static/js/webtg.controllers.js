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
    $scope.self = {};
    $scope.conversations = [];
    $scope.current_conversation = {};
    $scope.newmessage = {to: '', content: ''};
    $scope.contacts = [];
    $scope.current_contact = {};

    // event handlers
    $scope.$on('connection',function(evt,state){
      $scope.connection_state = state;
    });
    $scope.$on('session.state',function(evt,data){
      if(data.status=='connected'){
        $scope.username = data.username;
        $scope.getSelf();
        $scope.conversationsList();
        $scope.contactsList();
        $interval($scope.statusOnline, 30000);
      }else if(data.status=='not authenticated'){
        $scope.username = '';
        $window.location = '/login';
      }
    });
    $scope.$on('telegram.raw',function(evt,data){
      if(data.args[0]=='get_self'){
        $scope.self = JSON.parse(data.contents);
      }
    });
    $scope.$on('telegram.dialog_list',function(evt,data){
      $scope.conversations = data.contents;
      $scope.validateCurrentConversation();
      var chats = [];
      angular.forEach(data.contents, function(v,k){ if(v.type=='chat'){ this.push(v); } }, chats);
      $scope.setContacts(chats);
      $scope.validateCurrentContact();
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
    $scope.$on('telegram.contacts_list',function(evt,data){
      $scope.setContacts(data.contents);
      $scope.validateCurrentContact();
    });
    $scope.$on('telegram.contact_add',function(evt,data){
      $scope.contactsList();
    });
    $scope.$on('telegram.contact_delete',function(evt,data){
      var contacts = []
      angular.forEach($scope.contacts, function(v,k){ if(v.id!=data.extra.id) this.push(v); }, contacts);
      $scope.contacts = contacts;
      $scope.validateCurrentContact();
    });

    // telegram commands
    $scope.statusOnline = function(){
      socket.send({ 'event': 'telegram.status_online' });
    };
    $scope.getSelf = function(){
      socket.send({ 'event': 'telegram.raw', 'args': ['get_self'] });
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
    $scope.contactsList = function(){
      socket.send({ 'event': 'telegram.contacts_list' });
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
      if(!c.last_timestamp){ c.last_timestamp = 0; }
      var trackDuplicates = {};
      angular.forEach(c.messages, function(v,k){ this[v.id] = k; }, trackDuplicates);
      angular.forEach(messages, function(v,k){
        if(trackDuplicates[v.id] === undefined){
          trackDuplicates[v.id] = this.push.length;
          if(v.date > c.last_timestamp){ c.last_timestamp = v.date; }
          if(v.text){ v.text = emojione.toImage(v.text); }
          if(v.media && v.media.caption){ v.media.caption = emojione.toImage(v.media.caption); }
          this.push(v);
        }
      }, c.messages);
      $scope.setConversation(c);
    };
    $scope.setContacts = function(contacts,chats){
      var trackDuplicates = {};
      angular.forEach($scope.contacts, function(v,k){ this[v.id] = k; }, trackDuplicates);
      angular.forEach(contacts, function(v,k){
        if(trackDuplicates[v.id] === undefined){
          trackDuplicates[v.id] = this.push.length;
          if((v.type=='chat')&&(v.admin)){
            v.own = (v.admin.id == $scope.self.id);
            angular.forEach(v.members, function(vv,kk){ vv.admin = (vv.id==v.admin.id); });
          }
          this.push(v);
        }
      }, $scope.contacts);
    };
    $scope.setContact = function(contact, set_to){
      if($scope.current_contact.id != contact.id){
        $scope.current_contact = contact;
      }
      if(set_to!==false){
        $scope.newmessage.to = contact.print_name ? contact.print_name : contact.cmd;
      }
    };
    $scope.clearContact = function(){
      $scope.current_contact = {};
      $scope.newmessage.to = '';
    };
    $scope.validateCurrentContact = function(){
      var contact={};
      if($scope.contacts.length){
        if($scope.current_contact.id){
          angular.forEach($scope.contacts, function(v,k){ if(v.id==$scope.current_contact.id) contact=v; });
        }
        if(!contact.id){ contact = $scope.contacts[0]; }
        $scope.setContact(contact);
      }else{
        $scope.clearContact();
      }
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
  '$scope', '$modal', 'socket', '$log',
  function($scope, $modal, socket, $log){

    $scope.messageTo = function(contact){
      $scope.newmessage.to = contact.print_name ? contact.print_name : contact.cmd;
      angular.element('#newmessage-content').focus();
    };

    $scope.addContact = function(){
      var modalInstance = $modal.open({
        templateUrl: 'addContact.html',
        size: 'sm',
      });

      modalInstance.result.then(function(contact){
        $log.log('Add contact: ', contact);
        socket.send({
          event: 'telegram.contact_add',
          args:  [ contact.phone, contact.first_name, contact.last_name ],
        });
      }, function(){
        $log.log('Add contact: dismissed');
      });
    };

    $scope.delContact = function(contact){
      $log.log('Delete contact: ', contact);
      socket.send({
        event: 'telegram.contact_delete',
        args:  [ contact.print_name ],
        extra: contact
      });
    };
  }
]);
