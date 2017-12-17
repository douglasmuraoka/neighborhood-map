// Models
var MapViewModel = function (lat, lng, zoom) {
	var self = this;

	this.map = null; // GoogleMap

	this.mapOptions = ko.observable({
		'lat': ko.observable(lat),
		'lng': ko.observable(lng),
		'zoom': ko.observable(zoom)
	});

	// Contains the markers of our map
	this.markers = ko.observableArray([]);

	this.services = {};

	/**
	 * Creates a marker and adds it to the markers list
	 *
	 * @param title the HTML title attribute of the marker
	 * @param position google.map.LatLng instance
	 *
	 * @return void
	 */
	this.addMarker = function(title, position) {
		// Creates a marker and add it to the list of markers
		var marker = new google.maps.Marker({
			'title': title,
			'position': position,
			'map': self.map
		});
		this.markers.push(marker);
	};
};

// Custom Binding for Google Map
ko.bindingHandlers.googlemap = {
	init: function (element, valueAccessor, allBindingsAccessor, viewModel) {
		// Recovers ViewModel binded
		var viewModel = ko.unwrap(valueAccessor());

		// Initialization of our map with data from MapViewModel
		var mapOptions = viewModel.mapOptions();
		var location = new google.maps.LatLng(mapOptions.lat(), mapOptions.lng());
		viewModel.map = new google.maps.Map(element, {
			'center': location,
			'zoom': mapOptions.zoom()
		});

		// The request to PlacesService, to find our point of interest places
		var request = {
		    'location': location, // center of search location
		    'radius': 1000, // max distance, in meters
		    'type': ['point_of_interest'] // types of places we are searching for
		};

		// Instantiation of PlacesService to find nearby points of interest
		viewModel.services.places = new google.maps.places.PlacesService(viewModel.map);
		viewModel.services.places.nearbySearch(request, function callback(results, status) {
			// If the request went fine, create markers for the first 5 of the places
			if (status == google.maps.places.PlacesServiceStatus.OK) {
				for (var i = 0; i < 5; i++) {
					var place = results[i];

					// Adds a new marker, based on search result
					viewModel.addMarker(place.name, place.geometry.location);
				}
			}
		});
	}
};

ko.applyBindings(new MapViewModel(-23.59421, -46.6908882, 16));