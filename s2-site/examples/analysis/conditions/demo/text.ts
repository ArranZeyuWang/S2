import { PivotSheet } from '@antv/s2';
import '@antv/s2/dist/s2.min.css';

fetch(
  'https://gw.alipayobjects.com/os/bmw-prod/d62448ea-1f58-4498-8f76-b025dd53e570.json',
)
  .then((res) => res.json())
  .then((data) => {
    const container = document.getElementById('container');
    const s2DataConfig = {
      fields: {
        rows: ['province', 'city'],
        columns: ['type'],
        values: ['price'],
      },
      data,
    };

    const s2options = {
      width: 600,
      height: 600,
      interaction: {
        hoverHighlight: false,
      },
      conditions: {
        text: [
          {
            field: 'price',
            mapping(fieldValue, data) {
              return {
                // fill 是文本字段标记下唯一必须的字段，用于指定文本颜色
                fill: '#5B8FF9',
              };
            },
          },
        ],
      },
    };
    const s2 = new PivotSheet(container, s2DataConfig, s2options);

    s2.render();
  });
