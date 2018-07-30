const base64 = require('./libs/js-base64').Base64;
const io = require('./libs/socket.io-mp');

const uuid = (function () {
	let uid = 0;
	return function () {
		return ++uid;
	};
})();

const SPLIT_CHAR = '@@';

function WePush(config) {
	config = config || {};
	config.devType = config.devType || 'WEB';
	config.productCode = config.productCode || 1;
	config.deviceId = config.deviceId || Math.random().toString(16).slice(2);
	config.accountId = config.accountId || '';
	// 小程序/小游戏仅支持wss协议
	config.server = config.server || 'https://lconn.mpush.163.com';
	config.socketOptions = config.socketOptions || {};
	config.socketOptions.transports = ['websocket', 'polling'];

	this.config = config;
	this.socket = null;
	this.isReady = false;

	this.requestCallbacks = {}; // 请求的回调map
	this.topicListeners = {}; // 话题的订阅者
	this.isReady = false; // 是否就绪

	this.chatToListeners = []; // 上传消息队列
	this.authList = []; // 已获取授权列表

	this.setupConnect();
}


WePush.PUSH_TYPE = {
	MULTI: 'MULTI',
	GROUP: 'GROUP',
	SPECIAL: 'SPECIAL'
};

WePush.prototype.setupConnect = function () {
	const _this = this;
	this.socket = io(this.config.server, this.config.socketOptions);

	this.socket.on('connect', function () {
		// 这里也可能是 reconnect
		// 建立连接后立马注册
		_this.register(function () {
			this.isReady = true;
			// ready 置为 true，后续的新sub可以直接发subRequest
			// disconnect之后，之前sub的话题服务器都会不认，需要重新订阅
			for (const listenerKey in this.topicListeners) {
				if (this.topicListeners[listenerKey] && this.topicListeners[listenerKey].length) {
					const keys = listenerKey.split(SPLIT_CHAR);
					const topic = keys[0];
					const pushType = keys[1];
					// 发送订阅申请
					this.postSubRequest(topic, pushType);
				}
			}
			// 发送缓存的双向通信的上行消息
			if (this.chatToListeners.length > 0) {
				for (let i = 0; i < this.chatToListeners.length; i++) {
					this.chatToListeners[i]();
				}
			}
		});
	});

	this.socket.on('disconnect', function () {
		// 一旦disconnect,需要把isReady设置为false
		_this.isReady = false;
	});

	this.socket.on('data', function (data) {
		_this.responseHandler(data);
	});
};

WePush.prototype.register = function (cb) {
	const data = {
		devType: this.config.devType,
		deviceId: this.config.deviceId
	};

	this.postRequest(data, 'reg', cb);
};

/**
 * @desc 发送请求，用作内部调用，不作为暴露的API
 */
WePush.prototype.postRequest = function (data, type, cb) {
	let requestId = uuid();
	if (typeof cb === 'function') {
		this.requestCallbacks[requestId] = cb; // 保存回调函数
	}
	data.requestId = requestId;
	if (type !== 'authReq' && type !== 'ack') {
		data.productCode = this.config.productCode;
	}

	this.socket.emit('data', {
		data: JSON.stringify(data),
		type: type
	});
};

WePush.prototype.responseHandler = function (ret) {
	ret = ret || {};
	let data = JSON.parse(ret.data || '{}');
	let body;
	// ack消息应答
	if (data.messageId && data.ack) {
		this.answerAck(data.messageId)
	}
	if (ret.type === 'resp') {
		// 对于一个request，此时得到一个 response 了
		// 找到这个request的callback，执行callback
		// data=>{requestId,retCode}
		const callback = this.requestCallbacks[data.requestId];
		if (callback) {
			callback.call(this, data);
			delete this.requestCallbacks[data.requestId];
		}
	} else if (ret.type === 'ret') {
		// topic 推送消息过来了
		const topic = data.topic; // data=>{topic,pushType,body}
		const pushType = data.pushType;
		body = base64.decode(data.body);
		const listenerKey = topic + SPLIT_CHAR + pushType + '';
		const listenerList = this.topicListeners[listenerKey] || [];
		for (let i = 0; i < listenerList.length; i++) {
			listenerList[i].call(this, body);
		}
	} else if (ret.type === 'chatMsg') {
		// 双向通信
		body = base64.decode(data.msg);
		const chatCallback = this.chatListener;
		if (chatCallback && typeof chatCallback === 'function') {
			const _this = this;
			setTimeout(function () {
				chatCallback.call(_this, body);
			}, 0);
		}
	}
};

WePush.prototype.postSubRequest = function (topic, pushType, cb) {
	const data = {
		topic: topic,
		subType: 'SUB',
		pushType: pushType
	};
	// multi push
	if (this.config.accountId && pushType === WePush.PUSH_TYPE.MULTI) {
		data.accountId = this.config.accountId;
	}

	this.postRequest(data, 'sub', cb);
};

// 订阅主题
WePush.prototype.sub = function (param) {
	const topic = param.topic;
	const pushType = param.pushType;
	const listener = param.listener;
	const cb = param.callback;

	const listenerKey = topic + SPLIT_CHAR + pushType + '';
	const listenerList = this.topicListeners[listenerKey] || [];
	if (listenerList.length) {
		// 已经有人订阅此话题
		listenerList.push(listener);
		if (typeof cb === 'function') {
			const _this = this;
			setTimeout(function () {
				cb.call(_this);
			}, 0);
		}
	} else {
		listenerList.push(listener);
		this.topicListeners[topic + SPLIT_CHAR + pushType + ''] = listenerList;

		if (this.isReady) {
			this.postSubRequest(topic, pushType, cb);
		}
	}
};

// 接受双向通信消息
WePush.prototype.chatFrom = function (param) {
	this.chatListener = param.listener;
};

// 发送双向通信消息
WePush.prototype.chatTo = function (param) {
	const cb = param.callback;
	const channel = param.channel || 'HASH';
	let chatToTo = this.config.productCode + '.' + param.to + '_' + channel;
	let ignoreAuth = param.ignoreAuth || param.toType === 'DEVICE';
	// 向另一台设备发送消息
	if (ignoreAuth) {
		chatToTo = param.to
	}
	const data = {
		from: this.config.deviceId,
		to: chatToTo,
		msg: base64.encode(param.msg || ''),
		expiry: param.expiry || 0,
		fromType: param.fromType || 'DEVICE',
		toType: param.toType || 'BACKEND'
	};

	// 已获得过授权
	if (this.authList.indexOf(chatToTo) !== -1 || ignoreAuth) {
		if (this.isReady) {
			this.postRequest(data, 'chatMsg', cb);
		} else {
			this.chatToListeners.push(this.postRequest.bind(this, data, 'chatMsg', cb))
		}
	} else {
		// 未获得过授权需要先获取授权
		if (this.isReady) {
			this.authRequest({
				to: param.to,
				channel: channel,
				callback: this.postRequest.bind(this, data, 'chatMsg', cb)
			})
		} else {
			this.chatToListeners.push(this.authRequest.bind(this, {
				to: param.to,
				channel: channel,
				callback: this.postRequest.bind(this, data, 'chatMsg', cb)
			}))
		}
	}
};

// 应答ack消息
WePush.prototype.answerAck = function (messageId) {
	const data = {
		messageId: messageId
	};
	this.postRequest(data, 'ack');
};

// 请求业务端授权
WePush.prototype.authRequest = function (param) {
	// 请求授权字符串：{productCode}.{子系统名}_AUTH
	const authTo = this.config.productCode + '.' + param.to + '_AUTH';
	const chatToTo = this.config.productCode + '.' + param.to + '_' + param.channel;
	const authStr = chatToTo + ':1';

	const data = {
		deviceId: this.config.deviceId,
		to: authTo,
		authStr: authStr,
		sign: param.sign || ''
	};
	// 请求授权的回调函数
	const cb = function (to, data) {
		if (data.retCode === 'SUCCESS' || data.retCode === 'CACHED') {
			this.authList.push(to);
			param.callback()
		} else {
			throw new Error('设备授权失败')
		}
	};
	this.postRequest(data, 'authReq', cb.bind(this, chatToTo));
};

WePush.prototype.postUnsubRequest = function (topic, pushType, cb) {
	const data = {
		topic: topic,
		subType: 'UNSUB',
		pushType: pushType
	};
	this.postRequest(data, 'sub', cb);
};

WePush.prototype.unsub = function (param) {
	const topic = param.topic;
	const pushType = param.pushType;
	const listener = param.listener;
	const cb = param.callback;

	const listenerKey = topic + SPLIT_CHAR + pushType + '';
	const listenerList = this.topicListeners[listenerKey];

	if (listenerList && listenerList.length > 0) {
		if (!listener) {
			// 全部取消sub
			listenerList.length = 0;
		} else {
			// 取消当前listener
			for (let i = 0; i < listenerList.length; i++) {
				if (listenerList[i] === listener) {
					listenerList.splice(i, 1);
					break;
				}
			}
		}

		if (listenerList.length === 0) {
			// 没有人再订阅这个topic了
			delete this.topicListeners[listenerKey];
			if (this.isReady) {
				this.postUnsubRequest(topic, pushType, cb);
			}
			return;
		}
	}

	if (typeof cb === 'function') {
		const _this = this;
		setTimeout(function () {
			cb.call(_this);
		}, 0);
	}
};

module.exports = WePush;
