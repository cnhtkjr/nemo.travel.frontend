# Nemo Advanced Front-End Engine

Current version: 0.8

### How to setup

First of all, you have to place the source code from index.php wherever you want the engine to work.
Whatever it would be, it should start require.js and require script on the page.

Then you have to configure the host. It is needed for the engine to get to required libraries.
It could be done automatically with php, like it is done in index.php example:
```php
<?php $host = 'http'.(isset($_SERVER['HTTPS']) ? 's' : '').'://'.$_SERVER['HTTP_HOST']; ?>
```
Otherwise, you can configure host manually or any other way you want.

Then you should check that all needed libraries (they are listed in require.config) are linked correctly.
You may rewrite these paths:

```js
var nemoSourceHost = '<?php echo $host; ?>';
...
paths: {
			domReady:      nemoSourceHost+'/js/lib/requirejs/domReady',
			... ,
			touchpunch:    nemoSourceHost+'/js/lib/jquery.ui.touch-punch/v.0.2.3/jquery.ui.touch-punch.min'
		}
```

If the engine is started elsewhere from $host, then you have to configure root in requre.js initialization:
This variable represents engine location from $host:

```js
sourceURL: nemoSourceHost,
dataURL: 'http://demo.nemo.travel/api',
staticInfoURL: 'http://demo.nemo.travel',
root: '/',
```

For example, you need to place all libraries on your server in %hostname%/core/js etc.,
but Nemo should start on pages like %hostname%/avia/search/index.html, then you have to:

1. Set your $host to %hostname%
2. Rewrite directories from '/js/lib/...' to '/core/js/lib/...'
3. Set your root to /avia/search/


