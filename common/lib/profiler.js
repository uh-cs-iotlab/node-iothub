'use strict'

function Profiler (id) {
	this.data = {}
	this.startTime = undefined;
}

Profiler.prototype.getStartTime = function () {
	return this.startTime;
}

Profiler.prototype.start = function () {
	this.startTime = new Date().getTime();
	return this.startTime;
}

Profiler.prototype.add = function (data) {
	if (typeof data !== 'object') {
		throw new Error('First argument to Profiler.add must be an object');
	}
	if (!this.data[data.tag]) {
		this.data[data.tag] = [];
	} 
	if (data.time) {
		// nop
	} else if (this.startTime) {
		data.time = new Date().getTime() - this.startTime;
	} else {
		this.startTime = data.time = new Date().getTime();
	}
	this.data[data.tag].push(data);
}

Profiler.prototype.all = function () {
	return this.data;
}

Profiler.prototype.get = function (tag) {
	if (!this.data[tag]) {
		return undefined;
	}
	return this.data[tag];
}

Profiler.prototype.clear = function (tag) {
	if (typeof tag === 'string') {
		if (this.data[tag]) {
			delete this.data[tag];
			return true;
		} else {
			return false;
		}
	} else {
		throw new Error('A tag name must be specified as first argument to Profiler.clear');
	}
}

Profiler.prototype.clearAll = function() {
	delete this.data;
	this.data = {};
	return true;
}

// return Singleton to use single state
module.exports = new Profiler();
