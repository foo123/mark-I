window.addEventListener('load', function load(event) {
    window.removeEventListener('load', load, false);
    var appcontent = document.getElementById('appcontent');
    if ( appcontent && MarkI ) appcontent.addEventListener('DOMContentLoaded', MarkI.process, true);
}, false);


if ( !MarkI )
{
    var MarkI = { 

        // https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIURI
        makeURI: function(aURL, aOriginCharset, aBaseURI) {
            var ioService = Components
                            .classes["@mozilla.org/network/io-service;1"]
                            .getService(Components.interfaces.nsIIOService);
            return ioService.newURI(aURL, aOriginCharset, aBaseURI);
        }

        /**
         * Safely parse an HTML fragment, removing any executable
         * JavaScript, and return a document fragment.
         * https://developer.mozilla.org/en-US/Add-ons/Overlay_Extensions/XUL_School/DOM_Building_and_HTML_Insertion
         *
         * @param {Document} doc The document in which to create the
         *   returned DOM tree.
         * @param {string} html The HTML fragment to parse.
         * @param {boolean} allowStyle If true, allow <style> nodes and
         *   style attributes in the parsed fragment. Gecko 14+ only.
         * @param {nsIURI} baseURI The base URI relative to which resource
         *   URLs should be processed. Note that this will not work for
         *   XML fragments.
         * @param {boolean} isXML If true, parse the fragment as XML.
         */
        ,parseHTML: function(doc, html, allowStyle, baseURI, isXML) {
            const PARSER_UTILS = "@mozilla.org/parserutils;1";

            // User the newer nsIParserUtils on versions that support it.
            if (PARSER_UTILS in Components.classes) 
            {
                let parser = Components
                                .classes[PARSER_UTILS]
                                .getService(Ci.nsIParserUtils);
                if ("parseFragment" in parser)
                    return parser.parseFragment(html, allowStyle ? parser.SanitizerAllowStyle : 0,
                                                !!isXML, baseURI, doc.documentElement);
            }

            return Components.classes["@mozilla.org/feed-unescapehtml;1"]
                             .getService(Components.interfaces.nsIScriptableUnescapeHTML)
                             .parseFragment(html, !!isXML, baseURI, doc.documentElement);
        }

        ,addMeta: function( doc, metaObj ) {
            var name, meta;
            for ( name in metaObj )
            {
                if ( 'title' === name ) 
                {
                    doc.title = metaObj['title'];
                }
                else
                {
                    meta = doc.createElement('meta');
                    meta.name = name;
                    meta.content = metaObj[name];
                    doc.head.appendChild( meta );
                }
            }
        }

        // load resources
        ,loadResources: function( document, paths, options ) {
            options = options || {};
            var dl = paths.length, i = 0, t = 0, rel = /^\./, 
                resourceType = options.type || 'script', 
                baseURI = options.base || '', 
                //document = options.document, 
                scope = options.scope || (document.parentWindow || document.defaultView) || window, 
                callback = options.callback,
                head = document.getElementsByTagName("head")[ 0 ],
                link = document.createElement( 'a' ),
                load, next
            ;
            load = function( url, cb ) {
                var done = 0, resource, SRC = 'src', isInline = false, mimeType = "text/javascript", ID;
                if ( url.push )
                {
                    mimeType = url[1] || "text/javascript";
                    ID = url[2] || null;
                    url = url[0];
                    isInline = true;
                }
                if ( rel.test( url ) ) 
                {
                    // http://stackoverflow.com/a/14781678/3591273
                    // let the browser generate abs path
                    link.href = baseURI + url;
                    url = link.protocol + "//" + link.host + link.pathname + link.search + link.hash;
                }
                if ( 'script' === resourceType )
                {
                    resource = document.createElement('script');
                    if ( isInline )
                    {
                        resource.type = mimeType;
                        if ( ID ) resource.id = ID;
                        resource.innerHTML = MarkI.readFile( url );
                    }
                    else
                    {
                        resource.type = 'text/javascript'; resource.language = 'javascript';
                        SRC = 'src';
                        resource.onload = resource.onreadystatechange = function( ) {
                            if (!done && (!resource.readyState || resource.readyState == 'loaded' || resource.readyState == 'complete'))
                            {
                                done = 1; resource.onload = resource.onreadystatechange = null;
                                cb( );
                                //head.removeChild( resource ); resource = null;
                            }
                        }
                        // load it
                        resource[SRC] = url; head.appendChild( resource );
                    }
                }
                else if ( 'style' === resourceType )
                {
                    resource = document.createElement('link');
                    resource.type = 'text/css'; resource.rel = 'stylesheet';
                    SRC = 'href';
                    // load it
                    resource[SRC] = url; head.appendChild( resource );
                    cb( );
                }
                else 
                {
                    cb( );
                }
            };
            next = function( ) {
                if ( ++i >= dl ) { if ( callback ) callback( ); }
                else load( paths[ i ], next );
            };
            if ( i < dl ) load( paths[ i ], next );
            else if ( callback ) callback( );
        }

        ,empty: function( el ) {
            if ( el )
            {
                while ( el.firstChild ) el.removeChild( el.firstChild );
            }
            return el;
        }
        
        /*,readFile: function( fileURL ) {
            var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                .getService(Components.interfaces.nsIIOService);
            var scriptableStream = Components
                .classes["@mozilla.org/scriptableinputstream;1"]
                .getService(Components.interfaces.nsIScriptableInputStream);

            var channel = ioService.newChannel( fileURL, null, null );
            var input = channel.open( );
            scriptableStream.init( input );
            var str = scriptableStream.read( input.available( ) );
            scriptableStream.close( );
            input.close( );
            return str;
        }*/

        //var contents = Read("chrome://yourplugin/stuff.html");
        ,makePage: function( document, title, callback ) {
            MarkI.empty( document.body );
            MarkI.addMeta( document, {
                title: title.replace('<', '&lt;').replace('>', '&gt;')
                ,charset: "UTF-8"
                ,viewport: 'width=device-width, initial-scale=1'
            });
            
            document.body.innerHTML = '\
<div class="wrapper">\
<div id="in">\
    <textarea id="code"></textarea>\
</div>\
<div id="out"></div>\
<div id="controls">\
    <button id="btn-toggle" class="button toggle-button" title="Toggle Editor">&nbsp;</button>\
    <button id="btn-save" class="button save-button" title="Save File">&nbsp;</button>\
</div>\
</div>\
            ';
            
            MarkI.loadResources(document, [
                "resource://mkIresources/highlight/codemirror/lib/codemirror.min.css"
                ,"resource://mkIskin/mark-I.css"
            ], {type: 'style'});
            
            MarkI.loadResources(document, [
                //"resource://mkIresources/templates/Contemplate.min.js"
                "resource://mkIresources/markdown/marked.min.js"
                ,"resource://mkIresources/highlight/highlight.pack.js"
                ,"resource://mkIresources/highlight/codemirror/lib/codemirror.min.js"
                ,"resource://mkIresources/highlight/codemirror/xml/xml.js"
                ,"resource://mkIresources/highlight/codemirror/markdown/markdown.js"
                ,"resource://mkIresources/highlight/codemirror/gfm/gfm.js"
                ,"resource://mkIresources/highlight/codemirror/javascript/javascript.js"
                //,"resource://mkIresources/highlight/codemirror_grammar.js"
                ,"resource://mkIresources/viewer.js"
            ], {type: 'script', callback: callback});
        }
        
        ,markdownFileExtension: /\.m(arkdown|kdn?|d(o?wn)?)(#.*)?(.*)$/i
        
        ,process: function( aEvent ) {
            var document = aEvent.originalTarget, 
                scope = document.parentWindow || document.defaultView,
                URL = document.location.href
            ;

            if ( document.location.protocol !== "view-source:" && 
                MarkI.markdownFileExtension.test( URL ) ) 
            {
                var textContent = document.documentElement.textContent, 
                    pos = textContent.indexOf("\n");
                
                MarkI.makePage(
                    document, 
                    textContent.substr(0, pos>-1 ? Math.min(pos, 50) : 50),
                    function( ) {
                        // https://developer.mozilla.org/en-US/docs/Web/API/Window.postMessage
                        scope.postMessage({message: "render", data: textContent}, "*");
                });
            }
        }
    };
}