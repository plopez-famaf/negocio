import chalk from 'chalk';

export interface TableOptions {
  headers: string[];
  rows: (string | number | boolean)[][];
  maxWidth?: number;
  padding?: number;
  borderStyle?: 'single' | 'double' | 'rounded' | 'none';
  headerStyle?: 'bold' | 'underline' | 'none';
  alternateRows?: boolean;
}

export class Table {
  private options: Required<TableOptions>;

  constructor(options: TableOptions) {
    this.options = {
      maxWidth: process.stdout.columns || 120,
      padding: 1,
      borderStyle: 'single',
      headerStyle: 'bold',
      alternateRows: false,
      ...options,
    };
  }

  render(): string {
    const { headers, rows, padding, borderStyle, headerStyle, alternateRows } = this.options;
    
    if (rows.length === 0) {
      return 'No data to display';
    }

    // Calculate column widths
    const columnWidths = this.calculateColumnWidths(headers, rows);
    
    // Build table
    const lines: string[] = [];
    
    // Top border
    if (borderStyle !== 'none') {
      lines.push(this.renderBorder('top', columnWidths));
    }
    
    // Headers
    lines.push(this.renderRow(headers, columnWidths, padding, headerStyle));
    
    // Header separator
    if (borderStyle !== 'none') {
      lines.push(this.renderBorder('middle', columnWidths));
    }
    
    // Data rows
    rows.forEach((row, index) => {
      const style = alternateRows && index % 2 === 1 ? 'alternate' : 'normal';
      lines.push(this.renderRow(row.map(String), columnWidths, padding, style));
    });
    
    // Bottom border
    if (borderStyle !== 'none') {
      lines.push(this.renderBorder('bottom', columnWidths));
    }
    
    return lines.join('\n');
  }

  private calculateColumnWidths(headers: string[], rows: (string | number | boolean)[][]): number[] {
    const columnCount = headers.length;
    const columnWidths = new Array(columnCount).fill(0);
    
    // Check header widths
    headers.forEach((header, index) => {
      columnWidths[index] = Math.max(columnWidths[index], this.getDisplayWidth(header));
    });
    
    // Check row data widths
    rows.forEach(row => {
      row.forEach((cell, index) => {
        if (index < columnCount) {
          columnWidths[index] = Math.max(columnWidths[index], this.getDisplayWidth(String(cell)));
        }
      });
    });
    
    // Apply max width constraints
    const totalPadding = (columnCount + 1) * this.options.padding * 2;
    const availableWidth = this.options.maxWidth - totalPadding;
    const totalRequestedWidth = columnWidths.reduce((sum, width) => sum + width, 0);
    
    if (totalRequestedWidth > availableWidth) {
      // Proportionally reduce column widths
      const scale = availableWidth / totalRequestedWidth;
      columnWidths.forEach((width, index) => {
        columnWidths[index] = Math.floor(width * scale);
      });
    }
    
    return columnWidths;
  }

  private getDisplayWidth(text: string): number {
    // Remove ANSI escape codes for width calculation
    return text.replace(/\u001b\[[0-9;]*m/g, '').length;
  }

  private renderRow(cells: string[], columnWidths: number[], padding: number, style: string): string {
    const { borderStyle } = this.options;
    const paddingStr = ' '.repeat(padding);
    
    let formatted = cells.map((cell, index) => {
      const width = columnWidths[index];
      const truncated = this.truncateText(cell, width);
      const padded = truncated.padEnd(width);
      
      switch (style) {
        case 'bold':
          return chalk.bold(padded);
        case 'underline':
          return chalk.underline(padded);
        case 'alternate':
          return chalk.bgBlack(padded);
        default:
          return padded;
      }
    });
    
    if (borderStyle === 'none') {
      return formatted.join(paddingStr);
    }
    
    const border = this.getBorderChars();
    return border.vertical + paddingStr + formatted.join(paddingStr + border.vertical + paddingStr) + paddingStr + border.vertical;
  }

  private renderBorder(position: 'top' | 'middle' | 'bottom', columnWidths: number[]): string {
    const { padding, borderStyle } = this.options;
    
    if (borderStyle === 'none') {
      return '';
    }
    
    const border = this.getBorderChars();
    const paddingLength = padding * 2;
    
    let leftChar: string, rightChar: string, crossChar: string, horizontalChar: string;
    
    switch (position) {
      case 'top':
        leftChar = border.topLeft;
        rightChar = border.topRight;
        crossChar = border.topCross;
        horizontalChar = border.horizontal;
        break;
      case 'middle':
        leftChar = border.leftCross;
        rightChar = border.rightCross;
        crossChar = border.cross;
        horizontalChar = border.horizontal;
        break;
      case 'bottom':
        leftChar = border.bottomLeft;
        rightChar = border.bottomRight;
        crossChar = border.bottomCross;
        horizontalChar = border.horizontal;
        break;
    }
    
    const segments = columnWidths.map(width => horizontalChar.repeat(width + paddingLength));
    return leftChar + segments.join(crossChar) + rightChar;
  }

  private getBorderChars() {
    switch (this.options.borderStyle) {
      case 'double':
        return {
          horizontal: '═',
          vertical: '║',
          topLeft: '╔',
          topRight: '╗',
          bottomLeft: '╚',
          bottomRight: '╝',
          topCross: '╦',
          bottomCross: '╩',
          leftCross: '╠',
          rightCross: '╣',
          cross: '╬',
        };
      case 'rounded':
        return {
          horizontal: '─',
          vertical: '│',
          topLeft: '╭',
          topRight: '╮',
          bottomLeft: '╰',
          bottomRight: '╯',
          topCross: '┬',
          bottomCross: '┴',
          leftCross: '├',
          rightCross: '┤',
          cross: '┼',
        };
      case 'single':
      default:
        return {
          horizontal: '─',
          vertical: '│',
          topLeft: '┌',
          topRight: '┐',
          bottomLeft: '└',
          bottomRight: '┘',
          topCross: '┬',
          bottomCross: '┴',
          leftCross: '├',
          rightCross: '┤',
          cross: '┼',
        };
    }
  }

  private truncateText(text: string, maxWidth: number): string {
    const displayWidth = this.getDisplayWidth(text);
    if (displayWidth <= maxWidth) {
      return text;
    }
    
    // Simple truncation - could be improved to handle ANSI codes better
    const truncated = text.substring(0, maxWidth - 3);
    return truncated + '...';
  }
}

// Utility function for quick table creation
export function createTable(headers: string[], rows: (string | number | boolean)[][], options?: Partial<TableOptions>): string {
  const table = new Table({ headers, rows, ...options });
  return table.render();
}