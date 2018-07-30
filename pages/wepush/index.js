//index.js
//获取应用实例
const app = getApp();
const WePush = require('../../utils/wepush/wepush.js');
const wePush = new WePush({deviceId: 'wePush_test_device'});

Page({
  data: {
  },
  //事件处理函数
  send: function () {
    console.log(WePush);
    console.log(123);
    wePush.chatTo({
      msg: 'message1',
      to: 'ipush_test_device_1',
      toType: 'DEVICE',
      callback: function (d) {
        console.log('message1', '发送成功1', d);
      },
    });
  },
	unSub: function() {
		wePush.unsub({
			topic: 'wePush_test_device_topic_GROUP1',
			pushType: 'GROUP',
			callback(ret) {
				console.log(ret)
			}
		});
	},
  onLoad: function () {
    wePush.chatFrom({
      listener: function (data) {
        const message = `双向通信消息：${data} ----------- ${new Date().toLocaleString()}`;
        console.log(message)
      }
    });
		wePush.sub({
			topic: 'wePush_test_device_topic_SPECIAL',
			pushType: 'SPECIAL',
			listener: function(data) {
				const message = `订阅主题消息（SPECIAL）：${data} ----------- ${new Date().toLocaleString()}`;
				console.log(message)
			}
		});
		wePush.sub({
			topic: 'wePush_test_device_topic_GROUP1',
			pushType: 'GROUP',
			listener: function(data) {
				const message = `订阅主题消息111（GROUP）：${data} ----------- ${new Date().toLocaleString()}`;
				console.log(message)
			}
		});
		wePush.sub({
			topic: 'wePush_test_device_topic_GROUP2',
			pushType: 'GROUP',
			listener: function(data) {
				const message = `订阅主题消息222（GROUP）：${data} ----------- ${new Date().toLocaleString()}`;
				console.log(message)
			}
		});
  },
});
