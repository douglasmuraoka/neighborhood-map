// Models
var MapViewModel = function (lat, lng, zoom) {
	var self = this;

	// Params to create a GoogleMap
	this.mapParams = {
		'lat': lat,
		'lng': lng,
		'zoom': zoom
	};

	this.map = null; // GoogleMap

	// Contains the visible markers of our map
	this.markers = ko.observableArray();

	// The text used as filter of our markers
	this.filter = ko.observable('');

	// The message shown when some error during marker filtering occurs
	this.filterErrorMessage = ko.observable('');

	/**
	 * Function called to filter our markers with the user input
	 *
	 * @param filter <string> the user input
	 */
	self.search = function (filter) {
		// If user input is empty, show this error message
		if (self.isEmpty(filter)) {
			self.filterErrorMessage("Filter must not be empty!");
		}
		// Otherwise cleans error message and filter markers by title
		else {
			self.markers.removeAll();
			self.filterErrorMessage("");

			// Gets all markers filtering by its title
			var filteredMarkers = self.map.getMarkersByTitle(filter);
			for (var i=0; i<filteredMarkers.length; i++) {
				self.markers.push(filteredMarkers[i]);
			}
		}
	};
	// Sets this observer to invoke the search function when filter changes
	this.filter.subscribe(this.search);

	/**
	 * Function called when user clicks on an entry in the list of places
	 */
	self.clickList = function (marker) {
		self.map.selectMarker(marker);
	};

	/**
	 * Checks if the string param is defined, if so, checks if it is String and
	 * if there is any content not blank.
	 *
	 * @return true if a String is empty, false otherwise
	 */
	this.isEmpty = function (string) {
		return typeof string === "string" && string.trim() === "" && string.length > 0;
	};

	/**
	 * Returns a boolean that is controls the visibility of the filter error message.
	 * Only checks if the error message is not empty if there is some content being filtered.
	 * 
	 * @return true if there is a filter being applied and there is an error message to be shown,
	 *         false otherwise
	 */
	this.showFilterErrorMessage = ko.computed(function () {
		return this.isEmpty(this.filter()) && !this.isEmpty(this.filterErrorMessage());
	}, this);

	/**
	 * Clears the current filter and reset the state of the markers list to initial
	 * (all markers are visible).
	 * 
	 * @return void
	 */
	this.clearFilter = function () {
		self.filterErrorMessage("");
		self.filter("");
		self.markers.removeAll();

		// Adds all markers back to the map
		var allMarkers = self.map.getMarkers();
		for (var i=0; i<allMarkers.length; i++) {
			var marker = allMarkers[i];
			self.markers.push(marker);
			self.map.addMarker(marker);
		}
	};
};

// Custom Binding for Google Map
ko.bindingHandlers.googlemap = {
	init: function (element, valueAccessor, allBindingsAccessor, viewModel) {
		// Recovers ViewModel binded
		var viewModel = ko.unwrap(valueAccessor());

		// Gets container`s last element, which is the map div
		var mapDiv = element.lastElementChild;

		var mapParams = viewModel.mapParams;

		// Initialization of our map with data from MapViewModel
		viewModel.map = new NeighborhoodMap(mapDiv, mapParams.lat, mapParams.lng, mapParams.zoom, function () {
			// With this callback, we initialize our observableArray of markers
			viewModel.markers(viewModel.map.getMarkers().slice()); // with slice, we create a copy of markers array, instead of setting its reference
		});
	}
};

/**
 * Creates a new neighborhood map on a HTML element
 *
 * @param mapContainer the HTML element that will be the map container
 * @param lat initial latitude
 * @param lng initial longitude
 * @param zoom initial zoom
 * @param readyCallback function invoked when map loading is complete
 */
var NeighborhoodMap = function (mapContainer, lat, lng, zoom, readyCallback) {
	var self = this;

	var location = new google.maps.LatLng(lat, lng);

	// Our instance of GoogleMap
	this.map = new google.maps.Map(mapContainer, {
		'center': location,
		'zoom': zoom
	});

	// Contains all the markers of our model
	this.allMarkers = [];

	// Contains the InfoWindows mapped by the position (google.maps.LatLng)
	this.infoWindows = []; // {LatLng : InfoWindow}

	// The request to PlacesService, to find our point of interest places
	var request = {
	    'location': location, // center of search location
	    'radius': 1000 // max distance, in meters
	};

	// Instantiation of PlacesService to find nearby points of interest
	var placesService = new google.maps.places.PlacesService(this.map);
	placesService.nearbySearch(request, function (results, status) {
		// If the request went fine, create markers for the first 5 of the places
		if (status == google.maps.places.PlacesServiceStatus.OK) {
			for (var i = 0; i < 5; i++) {
				var place = results[i];

				// Adds a new marker, based on search result
				self.createMarker(place.name, place.geometry.location);
			}

			// After creating all the markers, invokes the callback
			if (readyCallback) {
				readyCallback();
			}
		} else {
			// If an error occurred, set an error message on an InfoWindow and display it on the center of the map
			var infowindow = new google.maps.InfoWindow({
				'content': 'An error occurred during places data fetching. Try again :(',
				'position': map.getCenter()
			});
			infowindow.open(map);
		}
	});
};

/**
 * Creates a marker and adds it to the markers list
 *
 * @param title the HTML title attribute of the marker
 * @param position google.map.LatLng instance
 *
 * @return void
 */
NeighborhoodMap.prototype.createMarker = function (title, position) {
	// Creates a marker and add it to the list of markers
	var marker = new google.maps.Marker({
		'title': title,
		'position': position,
		'map': this.map,
		'animation': google.maps.Animation.DROP
	});

	var content;
	// Creates a request to Wikipedia, allowing us to fetch additional info to show in an InfoWindow
	$.ajax('https://en.wikipedia.org/w/api.php', {
		'dataType': 'jsonp',
		'data': {
			'action': 'query',
			'list': 'search',
			'srsearch': title,
			'format': 'json',
			'prop': 'extracts',
			'exsentences': 1,
			'exintro': 1,
			'explaintext': 1
		},
		'timeout': 1000, // Sets the timeout to 1 second (I think we don't need more time than this to fetch data)

		// If the request succeeds, parses information to set as the marker's InfoWindow content
		'success': function (response) {
			var search = response.query.search;

			// If there is at least one valid search result, creates an InfoWindow that contains a snippet
			// and a hyperlink to the Wikipedia page.
			if (search.length > 0) {
				var wikipediaLink = '<br><a href="https://en.wikipedia.org/?curid='+ search[0].pageid + '" target="_blank">More info</a>';
				content = search[0].snippet + wikipediaLink;
			}
			// Otherwise, just put an error message to show at the InfoWindow
			else {
				content = 'No Wikipedia info found :(';
			}
		},
		// If some error occured, sets this message as InfoWindow content
		'error': function () {
			content = "An error occured during information fetch from Wikipedia :(";
		},
		// Whether we get a success or error during our request, we still need to create our InfoWindow with some info
		'complete': function () {
			var self = this;

			// Creates the InfoWindow with his content, and adds an click listener to his marker, to make it pop
			// up when the user clicks at the marker.
			var position = marker.getPosition();
			var infowindow = new google.maps.InfoWindow({
				'content': content,
				'position': position,
				'pixelOffset': new google.maps.Size(0, -50)
			});
			// Pushes to the infoWindows map, so we can get the InfoWindow when the user clicks at the list entries
			this.infoWindows[position] = infowindow;

			// Adds an event listener to open the InfoWindow whenever the user clicks the marker
			marker.addListener('click', function () {
				self.selectMarker(this);
			});
		}.bind(this)
	});
	// Pushes created marker to the list that contains all markers from our model
	this.allMarkers.push(marker);
};

/**
 * Adds a marker to the map
 *
 * @param marker the marker to be added
 */
NeighborhoodMap.prototype.addMarker = function (marker) {
	marker.setMap(this.map);
};

/**
 * Removes a marker from the map and closes its InfoWindow
 * 
 * @param marker the marker to be removed
 */
NeighborhoodMap.prototype.removeMarker = function (marker) {
	marker.setMap(null);
	this.infoWindows[marker.getPosition()].close();
};

/**
 * @return array of markers this map contains
 */
NeighborhoodMap.prototype.getMarkers = function () {
	return this.allMarkers;
};

/**
 * @param filter the string to be used as filter
 *
 * @return an filtered array of markers that contains the parameter filter as title
 */
NeighborhoodMap.prototype.getMarkersByTitle = function (filter) {
	var loweredCaseFilter = filter.toLowerCase().trim(); // lowers case to avoid problems with text comparison like "a" !== "A"
	var markers = this.getMarkers();
	var filteredMarkers = [];

	// For each marker, check if title contains the text input by user
	for (var i=0; i<markers.length; i++) {
		var marker = markers[i];
		var title = marker.getTitle().toLowerCase();

		// If marker title contains filter, adds it to the list
		if (title.indexOf(loweredCaseFilter) != -1) {
			filteredMarkers.push(marker);
		}
	}
	return filteredMarkers;
}

/**
 * Disables animation from every marker, except from the one given as parameter.
 * Enables animation from given marker, if it is disabled.
 *
 * @return void
 */
NeighborhoodMap.prototype.animateMarker = function (marker) {
	for (var i=0; i<this.allMarkers.length; i++) {
		var currentMarker = this.allMarkers[i];
		if (currentMarker !== marker) {
			currentMarker.setAnimation(null);
		}
	}
	if (marker.getAnimation() === null) {
		marker.setAnimation(google.maps.Animation.BOUNCE);
	}
};

/**
 * Function that concentrates all actions when users clicks on a marker or place entry on the list.
 * Opens the InfoWindow of the marker given, while closing every other InfoWindow active,
 * and activates marker animation.
 *
 * @return void
 */
NeighborhoodMap.prototype.selectMarker = function (marker) {
	// Animates the clicked marker
	this.animateMarker(marker);

	// Closes every InfoWindow on the map
	this.closeInfoWindows();

	// Opens the InfoWindow associated to the marker
	this.infoWindows[marker.getPosition()].open(this.map);
};

/**
 * Closes every InfoWindow on the map.
 *
 * @return void
 */
NeighborhoodMap.prototype.closeInfoWindows = function () {
	var positions = Object.keys(this.infoWindows);
	for (var i=0; i<positions.length; i++) {
		var infowindow = this.infoWindows[positions[i]];
		infowindow.close();
	}
};

var App = {
	// Callback invoked when GoogleMaps API is loaded and ready
	initMap: function () {
		ko.applyBindings(new MapViewModel(38.704842, -9.161464, 16));
	}
};