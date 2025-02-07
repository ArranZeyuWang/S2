import { PivotSheet, ColCell } from '@antv/s2';
import '@antv/s2/dist/s2.min.css';

// 自定义角头单元格，实现特有功能
class CustomColCell extends ColCell {
  // 覆盖背景绘制，可覆盖或者增加绘制方法
  drawBackgroundShape() {
    this.backgroundShape = this.addShape('image', {
      attrs: {
        ...this.getCellArea(),
        img: 'https://gw.alipayobjects.com/zos/antfincdn/og1XQOMyyj/1e3a8de1-3b42-405d-9f82-f92cb1c10413.png',
      },
    });
  }
}

fetch(
  'https://gw.alipayobjects.com/os/bmw-prod/cd9814d0-6dfa-42a6-8455-5a6bd0ff93ca.json',
)
  .then((res) => res.json())
  .then((res) => {
    const container = document.getElementById('container');
    const s2DataConfig = {
      fields: {
        rows: ['province', 'city'],
        columns: ['type', 'sub_type'],
        values: ['number'],
      },
      data: res.data,
    };
    const s2options = {
      width: 660,
      height: 600,
      colCell: (node, s2, headConfig) => {
        return new CustomColCell(node, s2, headConfig);
      },
    };
    const s2 = new PivotSheet(container, s2DataConfig, s2options);

    // 使用
    s2.render();
  });
