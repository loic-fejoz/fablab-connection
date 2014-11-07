(function ( $ ) {

var people_view_model;

/* Data visualisation part */
function Member(url, name, photo) {
    var self = this;
    self.name = ko.observable(name);
    self.url = ko.observable(url);
    if (photo) {
	self.photo = ko.observable(photo);
    } else {
	self.photo = ko.observable('http://www.gravatar.com/avatar/00000000000000000000000000000000?d=mm&f=y');
    }
    self.org = ko.observable();
}

function PeopleViewModel() {
    var self = this;
    // Editable data
    self.people = ko.observableArray([]);
    self.people_directory = {};
    self.addPeople = function(p) {
	self.people.push(p);
	self.people_directory[p.url()] = p;
    };
    self.hasPeople = function(url) {
	return url in self.people_directory;
    };
    self.updatePeople = function (p) {
	var props =  p['properties'];
	if (props) {
	    var url = props['url'];
	    if (url) {
		var m;
		if (self.hasPeople(url)) {
		    m = self.people_directory[url];
		} else {
		    m = new Member(url, "", undefined);
		    self.addPeople(m);
		}
		var photo = props['photo']
		if (photo) {
		    m.photo(photo);
		}
		var name = props['name']
		if (name) {
		    m.name(name);
		}
		var org = props['org']
		if (org) {
		    m.org(org);
		}
	    }
	}
    };
}

    /* Spider part */
    var requests_counter = 0;
    var visited = {};
    var to_visit = [];

    function parseMicroformat(node) {
        var options = {
            'node': node
        };
        var items = microformats.getItems(options);
        var output = $('#output');
        output.text(output.text() + '\n' + JSON.stringify(items));
	if (items['items']) {
	    var url;
	    $.each(items['items'], function (i, el) {
		people_view_model.updatePeople(el);
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
	/* Find all .h-card in the body part of the html received */
	/* Looking only the body part also avoid some scripts (like on mediawiki). */
	/* See http://jsfiddle.net/gb1mavy6/1/ */
	var body_start = data.indexOf("<body");
        body_start = data.indexOf(">", body_start) + 1;
        var body_end = data.indexOf("</body>");
        var body_part = data.substring(body_start, body_end);
        var d = $("<div/>");
        d.html(data);
        d = d.find('.h-card');
	console.log('found ' + d.length);
	/* Now analyse them all */
	var underanalysis = $('#underanalysis');
	underanalysis.append(d);
        parseMicroformat(underanalysis.get(0));
	underanalysis.empty();
    };
    

    function visit(url) {
	visited[url] = true;
	var options = {
            url: url,
            success: parseMF
	};
	$.ajax(options).always(function() {
	    requests_counter = requests_counter - 1;
	});
	requests_counter = requests_counter + 1;
    }

    function spider() {
	var current_url;
	while(to_visit.length > 0) {
	    current_url = to_visit.shift();
	    visit(current_url);
	}
	console.log('requests_counter=' + requests_counter);
	if (requests_counter > 0) {
	    window.setTimeout(spider, 1000);
	}
    }

$( document ).ready(function() {
    people_view_model = new PeopleViewModel();
    ko.applyBindings(people_view_model);

    $('#addressbar').submit(function (event) {
	event.preventDefault();
	var url = $('#address').val();
	console.log('submitted: ' + url);
	to_visit.push(url);
	spider();
	return false;
    });
}); 

}( jQuery ));
