import React from 'react';
import { PivotSheet } from '@antv/s2';
import '@antv/s2/dist/s2.min.css';

const CornerTooltip = <div>CornerTooltip</div>;

const RowTooltip = <div>RowTooltip</div>;

const ColTooltip = <div>ColTooltip</div>;

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
      tooltip: {
        showTooltip: true,
      },
      customSVGIcons: [
        {
          name: 'Filter',
          svg: 'https://gw.alipayobjects.com/zos/antfincdn/gu1Fsz3fw0/filter%26sort_filter.svg',
        },
      ],
      showDefaultHeaderActionIcon: false,
      headerActionIcons: [
        {
          iconNames: ['Filter'],
          belongsCell: 'colCell',
          displayCondition: (meta) => meta.id === 'root[&]纸张[&]price',
          action: (props) => {
            const { meta, event } = props;
            meta.spreadsheet.tooltip.show({
              position: { x: event.clientX, y: event.clientY },
              element: ColTooltip,
            });
          },
        },
        {
          iconNames: ['SortDown'],
          belongsCell: 'colCell',
          displayCondition: (meta) => meta.id === 'root[&]笔[&]price',
          action: (props) => {
            const { meta, event } = props;
            meta.spreadsheet.tooltip.show({
              position: { x: event.clientX, y: event.clientY },
              element: ColTooltip,
            });
          },
        },
        {
          iconNames: ['SortUp'],
          belongsCell: 'cornerCell',
          action: (props) => {
            const { meta, event } = props;
            meta.spreadsheet.tooltip.show({
              position: { x: event.clientX, y: event.clientY },
              element: CornerTooltip,
            });
          },
        },
        {
          iconNames: ['DrillDownIcon'],
          belongsCell: 'rowCell',
          action: (props) => {
            const { meta, event } = props;
            meta.spreadsheet.tooltip.show({
              position: { x: event.clientX, y: event.clientY },
              element: RowTooltip,
            });
          },
        },
      ],
    };
    const s2 = new PivotSheet(container, s2DataConfig, s2options);

    s2.render();
  });
