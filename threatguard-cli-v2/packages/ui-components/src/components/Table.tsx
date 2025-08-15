import React from 'react';
import { Box, Text } from 'ink';

interface TableProps {
  headers: string[];
  rows: (string | number | boolean)[][];
  maxWidth?: number;
  showBorder?: boolean;
  headerColor?: string;
  alternateRows?: boolean;
}

export const Table: React.FC<TableProps> = ({
  headers,
  rows,
  maxWidth = 80,
  showBorder = true,
  headerColor = 'cyan',
  alternateRows = false,
}) => {
  if (rows.length === 0) {
    return <Text color="gray">No data to display</Text>;
  }

  // Calculate column widths
  const columnWidths = calculateColumnWidths(headers, rows, maxWidth);

  return (
    <Box flexDirection="column">
      {/* Header */}
      {showBorder && <BorderRow columnWidths={columnWidths} position="top" />}
      
      <TableRow 
        cells={headers} 
        columnWidths={columnWidths} 
        color={headerColor}
        bold
      />
      
      {showBorder && <BorderRow columnWidths={columnWidths} position="middle" />}

      {/* Data rows */}
      {rows.map((row, index) => (
        <React.Fragment key={index}>
          <TableRow
            cells={row.map(String)}
            columnWidths={columnWidths}
            color={alternateRows && index % 2 === 1 ? 'gray' : 'white'}
          />
        </React.Fragment>
      ))}

      {showBorder && <BorderRow columnWidths={columnWidths} position="bottom" />}
    </Box>
  );
};

interface TableRowProps {
  cells: string[];
  columnWidths: number[];
  color?: string;
  bold?: boolean;
}

const TableRow: React.FC<TableRowProps> = ({ cells, columnWidths, color = 'white', bold = false }) => {
  return (
    <Box>
      <Text color="gray">│ </Text>
      {cells.map((cell, index) => (
        <React.Fragment key={index}>
          <Text color={color} bold={bold}>
            {truncateText(cell, columnWidths[index]).padEnd(columnWidths[index])}
          </Text>
          <Text color="gray"> │ </Text>
        </React.Fragment>
      ))}
    </Box>
  );
};

interface BorderRowProps {
  columnWidths: number[];
  position: 'top' | 'middle' | 'bottom';
}

const BorderRow: React.FC<BorderRowProps> = ({ columnWidths, position }) => {
  const chars = {
    top: { left: '┌', right: '┐', cross: '┬', horizontal: '─' },
    middle: { left: '├', right: '┤', cross: '┼', horizontal: '─' },
    bottom: { left: '└', right: '┘', cross: '┴', horizontal: '─' },
  };

  const { left, right, cross, horizontal } = chars[position];

  return (
    <Box>
      <Text color="gray">
        {left}
        {columnWidths
          .map(width => horizontal.repeat(width + 2))
          .join(cross)}
        {right}
      </Text>
    </Box>
  );
};

function calculateColumnWidths(headers: string[], rows: (string | number | boolean)[][], maxWidth: number): number[] {
  const columnCount = headers.length;
  const columnWidths = new Array(columnCount).fill(0);

  // Check header widths
  headers.forEach((header, index) => {
    columnWidths[index] = Math.max(columnWidths[index], header.length);
  });

  // Check row data widths
  rows.forEach(row => {
    row.forEach((cell, index) => {
      if (index < columnCount) {
        columnWidths[index] = Math.max(columnWidths[index], String(cell).length);
      }
    });
  });

  // Apply max width constraints
  const borders = (columnCount + 1) * 3; // "│ " for each column plus borders
  const availableWidth = maxWidth - borders;
  const totalRequestedWidth = columnWidths.reduce((sum, width) => sum + width, 0);

  if (totalRequestedWidth > availableWidth) {
    // Proportionally reduce column widths
    const scale = availableWidth / totalRequestedWidth;
    columnWidths.forEach((width, index) => {
      columnWidths[index] = Math.max(3, Math.floor(width * scale));
    });
  }

  return columnWidths;
}

function truncateText(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) {
    return text;
  }
  return text.substring(0, maxWidth - 3) + '...';
}