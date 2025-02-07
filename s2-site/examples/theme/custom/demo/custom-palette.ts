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
      height: 300,
    };

    const s2Palette = {
      basicColors: [
        '#FFFFFF',
        '#F8F5FE',
        '#EDE1FD',
        '#873BF4',
        '#7232CF',
        '#7232CF',
        '#7232CF',
        '#AB76F7',
        '#FFFFFF',
        '#DDC7FC',
        '#9858F5',
        '#B98EF8',
        '#873BF4',
        '#282B33',
        '#121826',
      ],

      // ---------- semantic colors ----------
      semanticColors: {
        red: '#FF4D4F',
        green: '#29A294',
      },
    };

    const s2 = new PivotSheet(container, s2DataConfig, s2options);

    s2.setThemeCfg({ palette: s2Palette });
    s2.render();
  });
