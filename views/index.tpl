<!doctype html>
<html lang="en" ng-app="webTg">
<head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <title>WebTg</title>
    <link rel="shortcut icon" href="/static/img/favicon.ico" type="image/x-icon" sizes="16x16 24x24 32x32 64x64"/>
    <link rel="stylesheet" href="/static/css/bootstrap.min.css">
    <link rel="stylesheet" href="/static/css/bootstrap-theme.min.css">
    <link rel="stylesheet" href="/static/css/style.css">

    <script src="/static/js/jquery-1.11.2.min.js"></script>
    <script src="/static/js/underscore-min.js"></script>

    <script src="/static/js/angular.min.js"></script>
    <script src="/static/js/angular-route.min.js"></script>
    <script src="/static/js/angular-sanitize.min.js"></script>
    <script src="/static/js/ui-bootstrap-tpls-0.12.1.min.js"></script>

    <script src="/static/js/webtg.app.js"></script>
    <script src="/static/js/webtg.services.js"></script>
    <script src="/static/js/webtg.controllers.js"></script>
</head>
<body ng-controller="MainCtrl">
    <div class="container">
        <div class="panel panel-primary">
            <div class="panel-heading">
                <div class="panel-title {{ connection_state }}" id="connection">
                    <h3>webTg!</h3>
                </div>
            </div>
            <div ng-if="username">
              <div class="panel-body">
                  Welcome<span ng-if="username != 'anonymous'">, <b>{{ username }}</b></span>.
              </div>
              <div class="panel-body">
                 <div class="btn-group btn-group-sm" role="group">
                   <a href="#/messages" class="btn" role="button" ng-class="$location.path()=='/messages'?'btn-primary':'btn-default'">messages</a>
                   <a href="#/contacts" class="btn" role="button" ng-class="$location.path()=='/contacts'?'btn-primary':'btn-default'">contacts</a>
                 </div>
                 <div class="pull-right" ng-if="username != 'anonymous'">
                    <a href="/logout" class="btn btn-default" role="button"><span class="glyphicon glyphicon-log-out" title="Logout"></span></a>
                 </div>
                 <div class="clearfix"></div>
              </div>
            </div>
            <div class="panel-footer">
              <div>
                <form id="msg-form" ng-submit="sendMessage()">
                  <div class="col-lg-2">
                    <input type="text" class="form-control" placeholder="to" ng-model="newmessage.to" required="" />
                  </div>
                  <div class="col-lg-9">
                    <input type="text" class="form-control" id="newmessage-content" placeholder="content" ng-model="newmessage.content" required="" />
                  </div>
                  <div class="col-lg-1">
                    <button type="submit" class="btn btn-default pull-right">Send</button>
                  </div>
                </form>
              </div>
              <div class="clearfix"></div>
            </div>
        </div>

        <div class="row">
            <p></p>
        </div>

       <div ng-view></div>

   </div>

</body>
</html>
