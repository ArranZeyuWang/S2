import { get } from 'lodash';
import { TableColCell } from './table-col-cell';

export class TableCornerCell extends TableColCell {
  public getStyle(name?: string) {
    return name ? this.theme[name] : get(this, 'theme.cornerCell');
  }
}
