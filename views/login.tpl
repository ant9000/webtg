<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <title>WebSup</title>
    <link rel="shortcut icon" href="/static/img/favicon.ico" type="image/x-icon" sizes="16x16 24x24 32x32 64x64"/>
    <link rel="stylesheet" href="/static/css/bootstrap.min.css">
    <link rel="stylesheet" href="/static/css/bootstrap-theme.min.css">
    <link rel="stylesheet" href="/static/css/style.css">
</head>
<body>
    <div class="container">
        <div class="panel panel-primary">
            <div class="panel-heading">
                <div class="panel-title" id="connection">
                    <h3>webTg!</h3>
                </div>
            </div>
            <div class="panel-body">
                Please login with your credentials.
            </div>
        </div>

% if error:
        <div class="row">
            <div class="col-md-8">
                <div class="alert alert-danger">{{ error }}</div>
           </div>
        </div>
% end

        <div class="row">
            <form method="post" name="login" class="form-horizontal col-md-2 col-md-offset-5">
                <div class="form-group">
                    <label for="username">Username:</label>
                    <input type="text" name="username" id="username" class="form-control" autofocus />
                </div>
                <div class="form-group">
                    <label for="password">Password:</label>
                    <input type="password" name="password" id="password" class="form-control" />
                </div>
                <div class="form-group">
                    <button type="submit" class="btn btn-primary pull-right">Login</button>
                </div>
            </form>
        </div>

    </div>
</body>
</html>
