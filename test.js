(function ( $ ) {
    var visited = {};
    var to_visit = ['http://localhost/mediawiki/index.php/Accueil'];

    function parseMicroformat(node) {
        var options = {
            'node': node
        };
        var items = microformats.getItems(options);
        var output = $('#output');
        $(output).text(output.text() + '\n' + JSON.stringify(items));
	if (items['items']) {
	    var url;
	    $.each(items['items'], function (i, el) {
		url = el['properties']['url'];
		if (url) {
		    if (visited[url] == undefined) {
			console.log('Need to visit ' + url);
			to_visit.push(url);
		    }
		}
	    });
	}
    };

    function parseMF(data, textStatus, jqXHR) {
        var d = $(data).find('.h-card');
	var underanalysis = $('#underanalysis');
        d.each( function( i, el ) {
	    underanalysis.append(el);
        });
        parseMicroformat(underanalysis.get(0));
	underanalysis.empty();
    };
    

    function visit(url) {
	visited[url] = true;
	var options = {
            url: url,
            success: parseMF,
            cache: false
	};
	$.ajax(options);
    }

    function spider() {
	var current_url;
	while(to_visit.length > 0) {
	    current_url = to_visit.shift();
	    visit(current_url);
	}
	window.setInterval(spider, 5000);
    }

    spider();
}( jQuery ));
