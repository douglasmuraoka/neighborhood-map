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

	// Contains the InfoWindows mapped by the position (google.maps.LatLng)
	this.infoWindows = []; // {LatLng : InfoWindow}

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
			'map': self.map,
			'animation': google.maps.Animation.DROP
		}));

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
			'success': function(response) {
			'timeout': 1000, // Sets the timeout to 1 second (I think we don't need more time than this to fetch data)

			// If the request succeeds, parses information to set as the marker's InfoWindow content
				var search = response.query.search;

				// If there is at least one valid search result, creates an InfoWindow that contains a snippet
				// and a hyperlink to the Wikipedia page.
				if (search.length > 0) {
					var wikipediaLink = '<br><a href="https://en.wikipedia.org/?curid='+ search[0].pageid + '">More info</a>';
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
				// Creates the InfoWindow with his content, and adds an click listener to his marker, to make it pop
				// up when the user clicks at the marker.
				var position = marker().getPosition();
				var infowindow = new google.maps.InfoWindow({
					'content': content,
					'position': position,
					'pixelOffset': new google.maps.Size(0, -50)
				});
				// Pushes to the infoWindows map, so we can get the InfoWindow when the user clicks at the list entries
				self.infoWindows[position] = infowindow;

				// Adds an event listener to open the InfoWindow whenever the user clicks the marker
				marker().addListener('click', function () {
					self.clickMarker(this);
				});
			}
		});
		// Pushes created marker to the list that contains all markers from our model
		this.allMarkers.push(marker);

		// Also pushes to the current active marker list
		this.markers.push(marker);
	};

	/**
	 * Disables animation from every marker, except from the one given as parameter.
	 * Enables animation from given marker, if it is disabled.
	 *
	 * @return void
	 */
	this.animateMarker = function(marker) {
		for (var i=0; i<self.allMarkers.length; i++) {
			var currentMarker = self.allMarkers[i]();
			if (currentMarker !== marker) {
				currentMarker.setAnimation(null);
			}
		}
		if (marker.getAnimation() === null) {
			marker.setAnimation(google.maps.Animation.BOUNCE);
		}
	}

	/**
	 * Function that concentrates all actions when users clicks on a marker or place entry on the list.
	 * Opens the InfoWindow of the marker given, while closing every other InfoWindow active,
	 * and activates marker animation.
	 *
	 * @return void
	 */
	this.clickMarker = function(marker) {
		// Animates the clicked marker
		self.animateMarker(marker);

		// Closes every InfoWindow on the map
		self.closeInfoWindows();

		// Opens the InfoWindow associated to the marker
		self.infoWindows[marker.getPosition()].open(self.map);
	};

	/**
	 * Closes every InfoWindow on the map.
	 *
	 * @return void
	 */
	this.closeInfoWindows = function() {
		var positions = Object.keys(self.infoWindows);
		for (var i=0; i<positions.length; i++) {
			var infowindow = self.infoWindows[positions[i]];
			infowindow.close();
		}
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
		    'radius': 1000 // max distance, in meters
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

ko.applyBindings(new MapViewModel(38.704842, -9.161464, 16));