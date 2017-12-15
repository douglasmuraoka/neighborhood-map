// Models
var MapViewModel = function (lat, lng, zoom) {
	var self = this;

	this.map = ko.observable({
		'lat': ko.observable(lat),
		'lng': ko.observable(lng),
		'zoom': ko.observable(zoom)
	});
};

// Custom Binding for Google Map
ko.bindingHandlers.googlemap = {
	init: function (element, valueAccessor, allBindingsAccessor, viewModel) {
		// Recovers model binded
		var model = valueAccessor()();

		// Initialization of our map with data from MapViewModel
		var googleMap = new google.maps.Map(element, {
			'center': new google.maps.LatLng(model.lat(), model.lng()),
			'zoom': model.zoom()
		});
	}
};

ko.applyBindings(new MapViewModel(-23.59421, -46.6908882, 18));