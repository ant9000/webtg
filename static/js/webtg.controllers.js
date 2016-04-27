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
    $scope.page_length = 25;

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
      angular.forEach(data.contents, function(v,k){ if(v.peer_type=='chat'){ this.push(v); } }, chats);
      $scope.setContacts(chats);
      $scope.validateCurrentContact();
    });
    $scope.$on('telegram.history',function(evt,data){
      if(!data.error){ $scope.setMessages(data.extra, data.contents); }
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
      angular.forEach($scope.contacts, function(v,k){ if(v.peer_id!=data.extra.peer_id) this.push(v); }, contacts);
      $scope.contacts = contacts;
      $scope.validateCurrentContact();
    });
    $scope.$on('telegram.service',function(evt,data){
      switch(data.action.type){
        case 'chat_created':
        case 'chat_add_user':
        case 'chat_del_user':
          $scope.conversationsList();
          break;
      }
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
    $scope.conversationHistory = function(older){
      var offset = $scope.current_conversation.messages && (older!==false) ? $scope.current_conversation.messages.length : 0;
      socket.send({
        event: 'telegram.history',
        args:  [ $scope.current_conversation.print_name, $scope.page_length, offset ],
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
        $scope.newmessage.to = conversation.print_name;
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
      if(messages.length < $scope.page_length){ c.all_read = true; }
      $scope.setConversation(c);
    };
    $scope.setContacts = function(contacts){
      var contactsIndex = {};
      angular.forEach($scope.contacts, function(v,k){ this[v.id] = k; }, contactsIndex);
      angular.forEach(contacts, function(v,k){
        if((v.peer_type=='chat')&&(v.admin)){
          v.own = false;
          angular.forEach(v.members, function(vv,kk){
            if(vv.inviter&&(vv.inviter.peer_id===0)){
              vv.admin=true;
              if((vv.peer_id==$scope.self.peer_id){ v.own=true; }
            }
          });
        }
        if(contactsIndex[v.id] === undefined){
          contactsIndex[v.id] = this.push.length;
          this.push(v);
        }else{
          this[k] = v;
        }
      }, $scope.contacts);
    };
    $scope.setContact = function(contact, set_to){
      $scope.current_contact = contact;
      if(set_to!==false){
        $scope.newmessage.to = contact.print_name;
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

    $scope.editGroup = function(group){
      $log.log('Editing group: ', group);
      var modalInstance = $modal.open({
        templateUrl: 'editGroup.html',
        controller:  'EditGroupCtrl',
        size: 'sm',
        resolve: {
          self:     function(){ return angular.copy($scope.self); },
          group:    function(){ return angular.copy(group); },
          contacts: function(){ return $scope.contacts; },
        }
      });
      var initial = angular.copy(group);
      modalInstance.result.then(function(group){
        if(!group.id){
          $log.log('Add new group: ', group);
          var members = [];
          angular.forEach(group.selected,function(v,k){ if(v) this.push(k); },members);
          if(group.title && members.length){
            socket.send({
              event: 'telegram.create_group_chat',
              args:  [ group.title ].concat(members),
            });
          }
        }else{
          $log.log('Edit group: ', initial, ' -> ', group);
          if(group.title && (group.title != initial.title)){
            socket.send({
              event: 'telegram.chat_rename',
              args:  [ group.print_name, group.title ],
            });
          }
          var variations = {};
          angular.forEach(group.selected, function(v,k){ if(v) this[k] = v; }, variations)
          angular.forEach(group.members, function(v,k){
            if(this[v.print_name]){
              delete this[v.print_name];
            }else{
              this[v.print_name] = false;
            }
          }, variations);
          $log.log('Edit group variations: ', variations);
          angular.forEach(variations,function(v,k){
            socket.send({
              event: 'telegram.chat_' + (v ? 'add' : 'del') + '_user',
              args:  [ group.print_name, k ],
            });
          });
        }
      }, function(){
        $log.log('Edit group: dismissed');
      });
    };

    $scope.leaveGroup = function(contact){
      $log.log('Leave group: ', contact);
      socket.send({
        event: 'telegram.chat_del_user',
        args:  [ contact.print_name, $scope.self.print_name ],
      });
      socket.send({
        event: 'telegram.raw',
        args:  [ 'delete_history '+contact.print_name ],
      });
      var contacts = [];
      angular.forEach($scope.contacts, function(v,k){ if(v.id != contact.id) this.push(v); }, contacts);
      $scope.contacts = contacts;
      $scope.current_contact = {};
      $scope.validateCurrentContact();
    };

  }
]);

webtgControllers.controller('EditGroupCtrl', function ($scope, $modalInstance, self, group, contacts) {
  $scope.self = self;
  $scope.group = group;
  $scope.contacts = contacts;
  group.selected = {};
  angular.forEach(group.members, function(v,k){ this[v.print_name] = true; }, group.selected); 
});
