//index.js
//获取应用实例
const app = getApp();
const WePush = require('../../utils/wepush/wepush.js');
const wePush = new WePush();

Page({
  data: {

  },
  //事件处理函数
  send: function () {
    console.log(WePush);
    console.log(123);
    console.log(this.wePush);
    wePush.chatTo({
      msg: 'message1',
      to: 'ipush_test_device_1',
      toType: 'DEVICE',
      callback: function (d) {
        console.log('message1', '发送成功1', d);
      },
    });
  },
  onLoad: function () {
    wePush.chatFrom({
      listener: function (data) {
        const message = `双向通信消息：${data} ----------- ${new Date().toLocaleString()}`;
        console.log(message)
      }
    });
  },
})
