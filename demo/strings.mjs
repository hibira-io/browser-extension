// The demo shop and its scripted Hibi, in the store's 7 languages, so each
// language's store screenshots show one language throughout.
export const LANGS = ['en', 'zh-TW', 'zh-CN', 'ja', 'ko', 'th', 'vi'];

export function pickLang(tag = '') {
  const l = String(tag).toLowerCase().split(',')[0].trim();
  if (l.startsWith('zh')) return /tw|hk|mo|hant/.test(l) ? 'zh-TW' : 'zh-CN';
  return LANGS.find((x) => l.startsWith(x)) ?? 'en';
}

export const S = {
  en: {
    nav: ['Orders', 'Products', 'Customers'], orders: 'Orders', order: 'Order', cols: ['Order', 'Customer', 'Items', 'Total', 'Status'],
    waiting: 'Awaiting shipment', shipped: 'Shipped', shipment: 'Shipment', carrier: 'Carrier', choose: 'Choose a carrier',
    tracking: 'Tracking number', save: 'Save shipment', saved: 'Shipment saved.', back: '← All orders',
    rows: [['Mika Tanaka', 'Ceramic mug ×2'], ['Leo Martins', 'Linen apron'], ['Ana Ruiz', 'Teapot, cups ×4']],
    prompt: 'Mark order #1042 shipped: DHL, tracking JD014600.',
    opening: 'Opening order #1042.', filled: 'Filled in DHL and JD014600. Saving needs your OK.',
    done: 'Order #1042 is marked shipped with DHL JD014600. Shall I do #1043 and #1044 the same way?',
  },
  'zh-TW': {
    nav: ['訂單', '商品', '顧客'], orders: '訂單', order: '訂單', cols: ['訂單', '顧客', '品項', '金額', '狀態'],
    waiting: '待出貨', shipped: '已出貨', shipment: '出貨資訊', carrier: '物流商', choose: '選擇物流商',
    tracking: '追蹤單號', save: '儲存出貨資訊', saved: '出貨資訊已儲存。', back: '← 所有訂單',
    rows: [['林雅婷', '陶瓷馬克杯 ×2'], ['陳柏宇', '亞麻圍裙'], ['王思涵', '茶壺、茶杯 ×4']],
    prompt: '把訂單 #1042 標成已出貨，DHL，追蹤單號 JD014600。',
    opening: '我先打開訂單 #1042。', filled: 'DHL 和 JD014600 都填好了，要儲存的話請按同意。',
    done: '訂單 #1042 已經標成已出貨（DHL JD014600）。#1043 和 #1044 也要照這樣處理嗎？',
  },
  'zh-CN': {
    nav: ['订单', '商品', '客户'], orders: '订单', order: '订单', cols: ['订单', '客户', '商品', '金额', '状态'],
    waiting: '待发货', shipped: '已发货', shipment: '发货信息', carrier: '快递公司', choose: '选择快递公司',
    tracking: '运单号', save: '保存发货信息', saved: '发货信息已保存。', back: '← 全部订单',
    rows: [['李静', '陶瓷马克杯 ×2'], ['张伟', '亚麻围裙'], ['刘洋', '茶壶、茶杯 ×4']],
    prompt: '把订单 #1042 标记为已发货，DHL，运单号 JD014600。',
    opening: '先打开订单 #1042。', filled: '已填好 DHL 和 JD014600，保存前需要你确认。',
    done: '订单 #1042 已标记为已发货（DHL JD014600）。#1043 和 #1044 也按这样处理吗？',
  },
  ja: {
    nav: ['注文', '商品', '顧客'], orders: '注文', order: '注文', cols: ['注文', '顧客', '商品', '合計', 'ステータス'],
    waiting: '発送待ち', shipped: '発送済み', shipment: '発送情報', carrier: '配送業者', choose: '配送業者を選択',
    tracking: '追跡番号', save: '発送情報を保存', saved: '発送情報を保存しました。', back: '← 注文一覧',
    rows: [['田中 美香', '陶器のマグ ×2'], ['佐藤 健', 'リネンのエプロン'], ['鈴木 綾', 'ティーポット、カップ ×4']],
    prompt: '注文 #1042 を発送済みにして。DHL、追跡番号 JD014600。',
    opening: '注文 #1042 を開きます。', filled: 'DHL と JD014600 を入力しました。保存するには承認してください。',
    done: '注文 #1042 を発送済み（DHL JD014600）にしました。#1043 と #1044 も同じように進めますか？',
  },
  ko: {
    nav: ['주문', '상품', '고객'], orders: '주문', order: '주문', cols: ['주문', '고객', '품목', '합계', '상태'],
    waiting: '배송 대기', shipped: '배송됨', shipment: '배송 정보', carrier: '택배사', choose: '택배사 선택',
    tracking: '운송장 번호', save: '배송 정보 저장', saved: '배송 정보를 저장했습니다.', back: '← 전체 주문',
    rows: [['김민지', '도자기 머그 ×2'], ['이준호', '린넨 앞치마'], ['박서연', '찻주전자, 찻잔 ×4']],
    prompt: '주문 #1042를 배송됨으로 바꿔 줘. DHL, 운송장 JD014600.',
    opening: '주문 #1042를 열게요.', filled: 'DHL과 JD014600을 입력했어요. 저장하려면 승인해 주세요.',
    done: '주문 #1042를 배송됨(DHL JD014600)으로 바꿨어요. #1043, #1044도 같은 방식으로 할까요?',
  },
  th: {
    nav: ['คำสั่งซื้อ', 'สินค้า', 'ลูกค้า'], orders: 'คำสั่งซื้อ', order: 'คำสั่งซื้อ', cols: ['คำสั่งซื้อ', 'ลูกค้า', 'สินค้า', 'ยอดรวม', 'สถานะ'],
    waiting: 'รอจัดส่ง', shipped: 'จัดส่งแล้ว', shipment: 'การจัดส่ง', carrier: 'บริษัทขนส่ง', choose: 'เลือกบริษัทขนส่ง',
    tracking: 'เลขพัสดุ', save: 'บันทึกการจัดส่ง', saved: 'บันทึกการจัดส่งแล้ว', back: '← คำสั่งซื้อทั้งหมด',
    rows: [['สมหญิง ใจดี', 'แก้วเซรามิก ×2'], ['ธนากร ศรีสุข', 'ผ้ากันเปื้อนลินิน'], ['พิมพ์ชนก วงศ์ไทย', 'กาน้ำชา ถ้วย ×4']],
    prompt: 'ตั้งคำสั่งซื้อ #1042 เป็นจัดส่งแล้ว DHL เลขพัสดุ JD014600',
    opening: 'กำลังเปิดคำสั่งซื้อ #1042', filled: 'กรอก DHL และ JD014600 แล้ว ต้องให้คุณอนุมัติก่อนบันทึก',
    done: 'คำสั่งซื้อ #1042 เป็นจัดส่งแล้ว (DHL JD014600) ให้ทำ #1043 และ #1044 แบบเดียวกันไหม?',
  },
  vi: {
    nav: ['Đơn hàng', 'Sản phẩm', 'Khách hàng'], orders: 'Đơn hàng', order: 'Đơn hàng', cols: ['Đơn hàng', 'Khách hàng', 'Sản phẩm', 'Tổng', 'Trạng thái'],
    waiting: 'Chờ giao', shipped: 'Đã giao cho vận chuyển', shipment: 'Vận chuyển', carrier: 'Đơn vị vận chuyển', choose: 'Chọn đơn vị vận chuyển',
    tracking: 'Mã vận đơn', save: 'Lưu thông tin vận chuyển', saved: 'Đã lưu thông tin vận chuyển.', back: '← Tất cả đơn hàng',
    rows: [['Nguyễn Thu Hà', 'Cốc gốm ×2'], ['Trần Minh Quân', 'Tạp dề vải lanh'], ['Lê Ngọc Anh', 'Ấm trà, chén ×4']],
    prompt: 'Đánh dấu đơn #1042 đã giao: DHL, mã vận đơn JD014600.',
    opening: 'Mình mở đơn #1042 nhé.', filled: 'Đã điền DHL và JD014600. Cần bạn duyệt trước khi lưu.',
    done: 'Đơn #1042 đã được đánh dấu đã giao (DHL JD014600). Mình làm tiếp #1043 và #1044 như vậy nhé?',
  },
};
