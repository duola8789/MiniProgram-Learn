Page({
  data: {
    time: new Date().toLocaleString(),
    number: -5,
    arr: [100, 200, 300],
    objectArray: [
      { id: 5, unique: 'unique_5' },
      { id: 4, unique: 'unique_4' },
      { id: 3, unique: 'unique_3' },
      { id: 2, unique: 'unique_2' },
      { id: 1, unique: 'unique_1' },
      { id: 0, unique: 'unique_0' },
    ],
    numberArray: [10, 20, 30, 40],
    color: 'green',
    loading: false
  },
  changeTime() {
    this.setData({ loading: true });
    setTimeout(() => {
      this.setData({ loading: false });
      wx.showModal({
        title: 'Modal标题',
        content: '告知状态',
        confirmText: '好的',
        cancelText: '取消',
        success(res) {
          if (res.confirm) {
            console.log('点击Confirm')
          } else if (res.cancel) {
          }
        }
      })
    }, 2000)
    // wx.switchTab({url: '/pages/index/index'})
  },
  onLoad() {
    let self = this;
    this.setData({ 'objectArray[0].id': 1000 }, () => {
      this.setData({ time: 999 })
    })
  },
  onPullDownRefresh(){
    console.log(123);
    wx.stopPullDownRefresh()
  }
});