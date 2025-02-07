import {
  head,
  last,
  isEmpty,
  get,
  clone,
  trim,
  max,
  isObject,
  forEach,
} from 'lodash';
import { getCsvString } from './export-worker';
import { SpreadSheet } from '@/sheet-type';
import { ViewMeta } from '@/common/interface';
import {
  ID_SEPARATOR,
  EMPTY_PLACEHOLDER,
  ROOT_BEGINNING_REGEX,
} from '@/common/constant';
import { MultiData } from '@/common/interface';

export const copyToClipboard = (str: string) => {
  try {
    const el = document.createElement('textarea');
    el.value = str;
    document.body.appendChild(el);
    el.select();
    const success = document.execCommand('copy');
    document.body.removeChild(el);
    return success;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return false;
  }
};

export const download = (str: string, fileName: string) => {
  try {
    const link = document.createElement('a');
    link.download = `${fileName}.csv`;
    // Avoid errors in Chinese encoding.
    const dataBlob = new Blob([`\ufeff${str}`], {
      type: 'text/csv;charset=utf-8',
    });

    link.href = URL.createObjectURL(dataBlob);
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
  }
};

/*
 * Process the multi-measure
 * use the ' ' to divide different measures in the same line
 * use the '$' to divide different lines
 */
const processObjectValue = (data: MultiData) => {
  const tempCell = data?.label ? [data?.label] : [];
  const values = data?.values;
  if (!isEmpty(values)) {
    forEach(values, (value) => {
      tempCell.push(value.join(' '));
    });
  }
  return tempCell.join('$');
};

/* Process the data in detail mode. */
const processValueInDetail = (
  sheetInstance: SpreadSheet,
  split: string,
  isFormat?: boolean,
): string[] => {
  const data = sheetInstance.dataSet.getDisplayDataSet();
  const { columns } = sheetInstance.dataCfg?.fields;
  const res = [];
  for (const [index, record] of data.entries()) {
    let tempRows = [];
    if (!isFormat) {
      tempRows = columns.map((v: string) => getCsvString(record[v]));
    } else {
      tempRows = columns.map((v: string) => {
        const mainFormatter = sheetInstance.dataSet.getFieldFormatter(v);
        return getCsvString(mainFormatter(record[v]));
      });
    }
    if (sheetInstance.options.showSeriesNumber) {
      tempRows = [getCsvString(index + 1)].concat(tempRows);
    }

    res.push(tempRows.join(split));
  }
  return res;
};

/* Process the data when the value position is on the columns.  */
const processValueInCol = (
  viewMeta: ViewMeta,
  sheetInstance: SpreadSheet,
  isFormat?: boolean,
): string => {
  if (!viewMeta) {
    // If the meta equals null, replacing it with blank line.
    return '';
  }
  const { fieldValue, valueField } = viewMeta;

  if (isObject(fieldValue)) {
    return processObjectValue(fieldValue);
  }

  if (!isFormat) {
    return `${fieldValue}`;
  }
  const mainFormatter = sheetInstance.dataSet.getFieldFormatter(valueField);
  return mainFormatter(fieldValue);
};

/* Process the data when the value position is on the rows. */
const processValueInRow = (
  viewMeta: ViewMeta,
  sheetInstance: SpreadSheet,
  isFormat?: boolean,
): string => {
  const tempCell = [];

  if (viewMeta) {
    const { data, fieldValue, valueField } = viewMeta;
    // The main measure.
    if (!isFormat) {
      tempCell.push(fieldValue);
    } else {
      const mainFormatter = sheetInstance.dataSet.getFieldFormatter(valueField);
      tempCell.push(mainFormatter(fieldValue));
    }
  } else {
    // If the meta equals null then it will be replaced by '-'.
    tempCell.push(EMPTY_PLACEHOLDER);
  }
  return tempCell.join('    ');
};

/**
 * Copy data
 * @param sheetInstance
 * @param isFormat
 * @param split
 */
export const copyData = (
  sheetInstance: SpreadSheet,
  split: string,
  isFormat?: boolean,
): string => {
  const { rowsHierarchy, rowLeafNodes, colLeafNodes, getCellMeta } =
    sheetInstance?.facet?.layoutResult;
  const { valueInCols } = sheetInstance.dataCfg.fields;
  // Generate the table header.

  const rowsHeader = rowsHierarchy.sampleNodesForAllLevels.map((item) =>
    sheetInstance.dataSet.getFieldName(item.key),
  );

  // get max query property length
  const rowLength = rowLeafNodes.reduce((pre, cur) => {
    const length = cur.query ? Object.keys(cur.query).length : 0;
    return length > pre ? length : pre;
  }, 0);

  let headers: string[][] = [];

  if (isEmpty(colLeafNodes) && !sheetInstance.isPivotMode()) {
    // when there is no column in detail mode
    headers = [rowsHeader];
  } else {
    // Get the table header of Columns.
    const tempColHeader = clone(colLeafNodes).map((colItem) => {
      let curColItem = colItem;
      const tempCol = [];
      // Generate the column dimensions.
      while (curColItem.level !== undefined) {
        tempCol.push(curColItem.label);
        curColItem = curColItem.parent;
      }
      return tempCol;
    });

    const colLevels = tempColHeader.map((colHeader) => colHeader.length);
    const colLevel = max(colLevels);

    const colHeader: string[][] = [];
    // Convert the number of column dimension levels to the corresponding array.
    for (let i = colLevel - 1; i >= 0; i -= 1) {
      // The map of data set: key-name
      const colHeaderItem = tempColHeader
        // total col completion
        .map((item) =>
          item.length < colLevel
            ? [...new Array(colLevel - item.length), ...item]
            : item,
        )
        .map((item) => item[i])
        .map((colItem) => sheetInstance.dataSet.getFieldName(colItem));
      colHeader.push(colHeaderItem);
    }

    // Generate the table header.
    headers = colHeader.map((item, index) => {
      return index < colHeader.length
        ? Array(rowLength)
            .fill('')
            .concat(...item)
        : rowsHeader.concat(...item);
    });
  }

  const headerRow = headers
    .map((header) => {
      return header.map((h) => getCsvString(h)).join(split);
    })
    .join('\r\n');

  // Generate the table body.
  let detailRows = [];
  let colLevel = 0;

  if (!sheetInstance.isPivotMode()) {
    detailRows = processValueInDetail(sheetInstance, split, isFormat);
  } else {
    // Filter out the related row head leaf nodes.
    const caredRowLeafNodes = rowLeafNodes.filter((row) => row.height !== 0);
    for (const rowNode of caredRowLeafNodes) {
      // Removing the space at the beginning of the line of the label.
      rowNode.label = trim(rowNode?.label);
      const id = rowNode.id.replace(ROOT_BEGINNING_REGEX, '');
      const tempLine = id.split(ID_SEPARATOR);
      if (tempLine.length < colLevel) {
        // total row completion
        tempLine.push(...new Array(colLevel - tempLine.length));
      } else {
        colLevel = tempLine.length;
      }
      const lastLabel = sheetInstance.dataSet.getFieldName(last(tempLine));
      tempLine[tempLine.length - 1] = lastLabel;
      const { rows: tempRows } = sheetInstance?.dataCfg?.fields;

      // Adapt to drill down mode.
      const emptyLength = tempRows.length - tempLine.length;
      for (let i = 0; i < emptyLength; i++) {
        tempLine.push('');
      }

      for (const colNode of colLeafNodes) {
        if (valueInCols) {
          const viewMeta = getCellMeta(rowNode.rowIndex, colNode.colIndex);
          tempLine.push(processValueInCol(viewMeta, sheetInstance, isFormat));
        } else {
          const viewMeta = getCellMeta(rowNode.rowIndex, colNode.colIndex);
          tempLine.push(processValueInRow(viewMeta, sheetInstance, isFormat));
        }
      }

      const lineString = tempLine
        .map((value) => getCsvString(value))
        .join(split);

      detailRows.push(lineString);
    }
  }

  const data = [headerRow].concat(detailRows);
  const result = data.join('\r\n');
  return result;
};
