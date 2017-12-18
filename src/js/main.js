// Models
var MapViewModel = function (lat, lng, zoom) {
	var self = this;

	this.map = null; // GoogleMap

	this.mapOptions = ko.observable({
		'lat': ko.observable(lat),
		'lng': ko.observable(lng),
		'zoom': ko.observable(zoom)
	});

	// Contains all the markers of our model
	this.allMarkers = [];

	// Contains the visible markers of our map
	this.markers = ko.observableArray([]);

	// The text used as filter of our markers
	this.filter = ko.observable();

	// The message shown when some error during marker filtering occurs
	this.filterErrorMessage = ko.observable();

	// Object to store external services, such as PlacesService from Google Map Places API
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
		var marker = ko.observable(new google.maps.Marker({
			'title': title,
			'position': position,
			'map': self.map
		}));
		this.allMarkers.push(marker);
		this.markers.push(marker);
	};

	/**
	 * Checks if the string param is defined, if so, checks if it is String and
	 * if there is any content not blank.
	 *
	 * @return true if a String is empty, false otherwise
	 */
	this.isEmpty = function(string){
		return !string || (typeof string === "string" && string.trim() === "");
	};

	/**
	 * Returns a boolean that is controls the visibility of the filter error message.
	 * Only checks if the error message is not empty if there is some content being filtered.
	 * 
	 * @return true if there is a filter being applied and there is an error message to be shown,
	 *         false otherwise
	 */
	this.showFilterErrorMessage = ko.computed(function() {
		return this.filter() != undefined && !this.isEmpty(this.filterErrorMessage());
	}, this);

	/**
	 * Applies filter based on the user input. If the input is empty, sets a
	 * error message to be shown on the screen. Does not destroy any marker instance,
	 * just controls the list of markers to be shown.
	 *
	 * @return void
	 */
	this.applyFilter = function(input) {
		var filter = input();
		if (filter !== undefined) {
			self.markers.removeAll();
			if (self.isEmpty(filter)) {
				self.filterErrorMessage("Filter must not be empty!");
			} else {
				self.filterErrorMessage("");
				filter = filter.toLowerCase();
				for (var i=0; i<self.allMarkers.length; i++) {
					var marker = self.allMarkers[i];
					var title = marker().getTitle().toLowerCase();
					if (title.indexOf(filter) != -1) {
						self.markers.push(marker);
						marker().setMap(self.map);
					} else {
						marker().setMap(null);
					}
				}
			}
		}
	};

	/**
	 * Clears the current filter and reset the state of the markers list to initial
	 * (all markers are visible).
	 * 
	 * @return void
	 */
	this.clearFilter = function() {
		self.filterErrorMessage("");
		self.filter("");
		self.markers.removeAll();
		for (var i=0; i<self.allMarkers.length; i++) {
			var marker = self.allMarkers[i];
			self.markers.push(marker);
			marker().setMap(self.map);
		}
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

		// Gets container`s last element, which is the map div
		var mapDiv = element.lastElementChild;
		viewModel.map = new google.maps.Map(mapDiv, {
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