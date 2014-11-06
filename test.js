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
    var visited = {};
    var to_visit = [];

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
