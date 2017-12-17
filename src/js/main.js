// Models
var MapViewModel = function (lat, lng, zoom) {
	var self = this;

	this.map = null; // GoogleMap

	this.mapOptions = ko.observable({
		'lat': ko.observable(lat),
		'lng': ko.observable(lng),
		'zoom': ko.observable(zoom)
	});
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
	}
};

ko.applyBindings(new MapViewModel(-23.59421, -46.6908882, 18));