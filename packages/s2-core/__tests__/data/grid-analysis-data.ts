import { S2Options } from '@/common/interface/s2Options';

export const mockGridAnalysisOptions = {
  width: 1000,
  height: 600,
  hierarchyType: 'grid',
  style: {
    cellCfg: {
      lineHeight: 20,
      width: 400,
      height: 100,
      minorMeasureRowIndex: 3,
      firstDerivedMeasureRowIndex: 2,
    },
  },
} as S2Options;

export const mockGridAnalysisDataCfg = {
  fields: {
    rows: ['level'],
    columns: ['group'],
    values: ['value'],
  },
  meta: [
    { field: 'group', name: '人群' },
    { field: 'level', name: '收入水平' },
  ],
  data: [
    {
      group: '青年',
      level: '高收入',
      value: {
        label: '青年高收入人群',
        values: [
          ['近30天信用卡支出（平均）', 40000, '+3%', '+520'],
          ['近30天信用卡分期（平均）', 50000, '+2%', '+500'],
          ['月初信用卡额度', 400000, '+3%', '+5000'],
        ],
      },
    },
    {
      group: '青年',
      level: '中收入',
      value: {
        label: '青年中收入人群',
        values: [
          ['近30天信用卡支出（平均）', 1000, '-3%', '-500'],
          ['近30天信用卡分期（平均）', 2000, '+23%', '+500'],
          ['月初信用卡额度', 3000, '+23%', '+500'],
        ],
      },
    },
    {
      group: '青年',
      level: '低收入',
      value: {
        label: '青年低收入人群',
        values: [
          ['近30天信用卡支出（平均）', 1200, '-43%', '-600'],
          ['近30天信用卡分期（平均）', 2000, '+20%', '+400'],
          ['月初信用卡额度', 3000, '+23%', '+500'],
        ],
      },
    },
    {
      group: '中年',
      level: '高收入',
      value: {
        label: '中年高收入人群',
        values: [
          ['近30天信用卡支出（平均）', 40000, '+23%', '+500'],
          ['近30天信用卡分期（平均）', 50000, '+23%', '+500'],
          ['月初信用卡额度', 400000, '+23%', '+500'],
        ],
      },
    },
    {
      group: '中年',
      level: '中收入',
      value: {
        label: '中年中收入人群',
        values: [
          ['近30天信用卡支出（平均）', 1000, '+23%', '+500'],
          ['近30天信用卡分期（平均）', 2000, '+23%', '+500'],
          ['月初信用卡额度', 3000, '+23%', '+500'],
        ],
      },
    },
    {
      group: '中年',
      level: '低收入',
      value: {
        label: '中年低收入人群',
        values: [
          ['近30天信用卡支出（平均）', 1000, '+23%', '+500'],
          ['近30天信用卡分期（平均）', 2000, '+23%', '+500'],
          ['月初信用卡额度', 3000, '+23%', '+500'],
        ],
      },
    },
    {
      group: '老年',
      level: '高收入',
      value: {
        label: '老年高收入人群',
        values: [
          ['近30天信用卡支出（平均）', 40000, '+23%', '+500'],
          ['近30天信用卡分期（平均）', 50000, '+23%', '+500'],
          ['月初信用卡额度', 400000, '+23%', '+500'],
        ],
      },
    },
    {
      group: '老年',
      level: '中收入',
      value: {
        label: '老年中收入人群',
        values: [
          ['近30天信用卡支出（平均）', 1000, '+23%', '+500'],
          ['近30天信用卡分期（平均）', 2000, '+23%', '+500'],
          ['月初信用卡额度', 3000, '+23%', '+500'],
        ],
      },
    },
    {
      group: '老年',
      level: '低收入',
      value: {
        label: '老年低收入人群',
        values: [
          ['近30天信用卡支出（平均）', 1000, '+23%', '+500'],
          ['近30天信用卡分期（平均）', 2000, '+23%', '+500'],
          ['月初信用卡额度', 3000, '+23%', '+500'],
        ],
      },
    },
  ],
};
export const mockTabularOptions = {
  width: 800,
  height: 600,
  // hierarchyType: 'grid',
  style: {
    cellCfg: {
      lineHeight: 30,
      width: 400,
      height: 300,
      minorMeasureRowIndex: 3,
      firstDerivedMeasureRowIndex: 2,
    },
  },
};
