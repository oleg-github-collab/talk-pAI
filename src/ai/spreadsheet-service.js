const ExcelJS = require('exceljs');
const Logger = require('../utils/enhanced-logger');
const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');

/**
 * Spreadsheet Generation Service for AI Assistant
 * Provides Excel/CSV generation capabilities with AI-powered data analysis
 */
class SpreadsheetService {
  constructor() {
    this.logger = new Logger('SpreadsheetService');
    this.openai = null;
    this.outputDir = 'uploads/generated-spreadsheets';
    this.isReady = false;
    this.initialize();
  }

  async initialize() {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (apiKey) {
        this.openai = new OpenAI({
          apiKey,
          timeout: 60000,
          maxRetries: 3
        });
      }

      // Ensure output directory exists
      await this.ensureOutputDirectory();

      this.isReady = true;
      this.logger.info('Spreadsheet service initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize Spreadsheet service', { error: error.message });
      this.isReady = false;
    }
  }

  async ensureOutputDirectory() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      this.logger.warn('Failed to create output directory', { error: error.message });
    }
  }

  async generateSpreadsheet(data, options = {}) {
    const {
      format = 'xlsx', // 'xlsx', 'csv'
      title = 'Generated Spreadsheet',
      includeCharts = false,
      includeAnalysis = false,
      styling = 'basic', // 'basic', 'professional', 'colorful'
      autoColumns = true
    } = options;

    try {
      this.logger.info('Starting spreadsheet generation', {
        format,
        title,
        rowCount: Array.isArray(data) ? data.length : 0
      });

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(title);

      // Set up data
      const processedData = await this.processData(data, options);

      // Add headers and data
      if (processedData.headers) {
        worksheet.addRow(processedData.headers);
        this.styleHeaders(worksheet, styling);
      }

      // Add data rows
      for (const row of processedData.rows) {
        worksheet.addRow(row);
      }

      // Auto-size columns
      if (autoColumns) {
        this.autoSizeColumns(worksheet);
      }

      // Apply styling
      this.applyWorksheetStyling(worksheet, styling);

      // Add charts if requested
      if (includeCharts && processedData.numericColumns.length > 0) {
        await this.addCharts(workbook, worksheet, processedData);
      }

      // Add analysis sheet if requested
      if (includeAnalysis && this.openai) {
        await this.addAnalysisSheet(workbook, processedData, options);
      }

      // Save file
      const filename = await this.saveWorkbook(workbook, title, format);

      this.logger.info('Spreadsheet generation completed', {
        filename,
        format,
        sheets: workbook.worksheets.length
      });

      return {
        filename,
        filepath: path.join(this.outputDir, filename),
        metadata: {
          title,
          format,
          rowCount: processedData.rows.length,
          columnCount: processedData.headers?.length || 0,
          includeCharts,
          includeAnalysis,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      this.logger.error('Spreadsheet generation failed', { error: error.message });
      throw new Error('Failed to generate spreadsheet: ' + error.message);
    }
  }

  async processData(data, options) {
    if (Array.isArray(data) && data.length > 0) {
      return this.processArrayData(data, options);
    } else if (typeof data === 'object' && data !== null) {
      return this.processObjectData(data, options);
    } else if (typeof data === 'string') {
      return await this.processTextData(data, options);
    } else {
      throw new Error('Unsupported data format');
    }
  }

  processArrayData(data, options) {
    const firstItem = data[0];
    let headers = [];
    let rows = [];
    let numericColumns = [];

    if (typeof firstItem === 'object' && firstItem !== null) {
      // Array of objects
      headers = Object.keys(firstItem);
      rows = data.map(item => headers.map(header => item[header] || ''));

      // Identify numeric columns
      numericColumns = headers.filter(header => {
        return data.some(item => typeof item[header] === 'number' && !isNaN(item[header]));
      });

    } else if (Array.isArray(firstItem)) {
      // Array of arrays
      headers = options.headers || firstItem.map((_, index) => `Column ${index + 1}`);
      rows = data.slice(options.headers ? 0 : 1);

      // Identify numeric columns
      numericColumns = headers.filter((_, index) => {
        return rows.some(row => typeof row[index] === 'number' && !isNaN(row[index]));
      });

    } else {
      // Array of primitives
      headers = ['Value'];
      rows = data.map(item => [item]);

      if (data.some(item => typeof item === 'number' && !isNaN(item))) {
        numericColumns = ['Value'];
      }
    }

    return { headers, rows, numericColumns };
  }

  processObjectData(data, options) {
    const headers = ['Property', 'Value'];
    const rows = Object.entries(data).map(([key, value]) => [
      key,
      typeof value === 'object' ? JSON.stringify(value) : value
    ]);

    const numericColumns = [];
    if (rows.some(row => typeof row[1] === 'number' && !isNaN(row[1]))) {
      numericColumns.push('Value');
    }

    return { headers, rows, numericColumns };
  }

  async processTextData(data, options) {
    if (!this.openai) {
      // Simple CSV parsing fallback
      const lines = data.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const rows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim()));

      return { headers, rows, numericColumns: [] };
    }

    try {
      // Use AI to structure text data
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a data analyst. Convert the given text into structured tabular data.

Guidelines:
1. Identify the most logical way to structure this data into rows and columns
2. Create appropriate column headers
3. Extract data into rows
4. Return as JSON with format: {"headers": ["Col1", "Col2"], "rows": [["val1", "val2"]], "description": "explanation"}
5. If the text contains numerical data, preserve it as numbers
6. Maximum 50 rows to keep response manageable`
          },
          {
            role: 'user',
            content: `Convert this text to structured data:\n\n${data.substring(0, 2000)}`
          }
        ],
        max_tokens: 1500,
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0].message.content);

      // Identify numeric columns
      const numericColumns = result.headers.filter((header, index) => {
        return result.rows.some(row => {
          const value = row[index];
          return typeof value === 'number' || (!isNaN(parseFloat(value)) && isFinite(value));
        });
      });

      return {
        headers: result.headers,
        rows: result.rows,
        numericColumns,
        description: result.description
      };

    } catch (error) {
      this.logger.warn('AI text processing failed, using simple parsing', { error: error.message });

      // Fallback to simple line parsing
      const lines = data.trim().split('\n').filter(line => line.trim());
      const headers = ['Line Number', 'Content'];
      const rows = lines.map((line, index) => [index + 1, line.trim()]);

      return { headers, rows, numericColumns: ['Line Number'] };
    }
  }

  styleHeaders(worksheet, styling) {
    const headerRow = worksheet.getRow(1);

    const styles = {
      basic: {
        font: { bold: true },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } },
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      },
      professional: {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } },
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      },
      colorful: {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4CAF50' } },
        border: {
          top: { style: 'medium' },
          left: { style: 'medium' },
          bottom: { style: 'medium' },
          right: { style: 'medium' }
        }
      }
    };

    const style = styles[styling] || styles.basic;

    headerRow.eachCell(cell => {
      Object.assign(cell, style);
    });
  }

  applyWorksheetStyling(worksheet, styling) {
    // Apply alternating row colors
    const fillColors = {
      basic: { even: 'FFF9F9F9', odd: 'FFFFFFFF' },
      professional: { even: 'FFF8F9FA', odd: 'FFFFFFFF' },
      colorful: { even: 'FFE8F5E8', odd: 'FFFFFFFF' }
    };

    const colors = fillColors[styling] || fillColors.basic;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const fillColor = rowNumber % 2 === 0 ? colors.even : colors.odd;

      row.eachCell(cell => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: fillColor }
        };

        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
  }

  autoSizeColumns(worksheet) {
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(Math.max(maxLength + 2, 10), 50);
    });
  }

  async addCharts(workbook, worksheet, processedData) {
    if (processedData.numericColumns.length === 0) return;

    try {
      // Create a chart for the first numeric column
      const numericColumnIndex = processedData.headers.indexOf(processedData.numericColumns[0]);
      const dataRange = `${worksheet.name}!${this.getColumnLetter(numericColumnIndex)}2:${this.getColumnLetter(numericColumnIndex)}${processedData.rows.length + 1}`;

      // Note: ExcelJS doesn't support charts directly, but we can add chart data
      // This would require additional chart generation libraries for full implementation
      this.logger.info('Chart data prepared', {
        numericColumns: processedData.numericColumns.length,
        dataRange
      });

    } catch (error) {
      this.logger.warn('Failed to add charts', { error: error.message });
    }
  }

  async addAnalysisSheet(workbook, processedData, options) {
    if (!this.openai) return;

    try {
      // Generate AI analysis of the data
      const analysisPrompt = this.buildAnalysisPrompt(processedData);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a data analyst. Provide insights, patterns, and recommendations based on the given data structure and sample.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      });

      const analysis = response.choices[0].message.content;

      // Create analysis worksheet
      const analysisSheet = workbook.addWorksheet('Data Analysis');

      // Add analysis content
      const analysisLines = analysis.split('\n').filter(line => line.trim());
      analysisLines.forEach((line, index) => {
        analysisSheet.addRow([line]);

        // Style headers (lines starting with numbers or bullets)
        if (line.match(/^\d+\./) || line.match(/^[•\-\*]/)) {
          const row = analysisSheet.getRow(index + 1);
          row.font = { bold: true };
        }
      });

      // Auto-size the analysis column
      analysisSheet.getColumn(1).width = 80;

      this.logger.info('Analysis sheet added successfully');

    } catch (error) {
      this.logger.warn('Failed to add analysis sheet', { error: error.message });
    }
  }

  buildAnalysisPrompt(processedData) {
    const sampleData = processedData.rows.slice(0, 5).map(row =>
      processedData.headers.reduce((obj, header, index) => {
        obj[header] = row[index];
        return obj;
      }, {})
    );

    return `Analyze this dataset:

Headers: ${processedData.headers.join(', ')}
Numeric columns: ${processedData.numericColumns.join(', ')}
Total rows: ${processedData.rows.length}
Sample data: ${JSON.stringify(sampleData, null, 2)}

Please provide:
1. Data overview and structure
2. Key insights and patterns
3. Data quality observations
4. Potential use cases
5. Recommendations for further analysis`;
  }

  async saveWorkbook(workbook, title, format) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const filename = `${timestamp}_${safeTitle}.${format}`;
    const filepath = path.join(this.outputDir, filename);

    if (format === 'xlsx') {
      await workbook.xlsx.writeFile(filepath);
    } else if (format === 'csv') {
      // For CSV, only export the first worksheet
      const worksheet = workbook.worksheets[0];
      const csvContent = this.worksheetToCSV(worksheet);
      await fs.writeFile(filepath, csvContent, 'utf8');
    }

    return filename;
  }

  worksheetToCSV(worksheet) {
    const rows = [];
    worksheet.eachRow(row => {
      const values = [];
      row.eachCell({ includeEmpty: true }, cell => {
        let value = cell.value || '';
        if (typeof value === 'string' && value.includes(',')) {
          value = `"${value}"`;
        }
        values.push(value);
      });
      rows.push(values.join(','));
    });
    return rows.join('\n');
  }

  getColumnLetter(columnIndex) {
    let letter = '';
    let temp = columnIndex;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  }

  async generateFromDescription(description, options = {}) {
    if (!this.openai) {
      throw new Error('AI-powered generation requires OpenAI API key');
    }

    try {
      this.logger.info('Generating spreadsheet from description', {
        description: description.substring(0, 100)
      });

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a spreadsheet expert. Generate structured data based on user descriptions.

Return JSON with format:
{
  "title": "Spreadsheet Title",
  "headers": ["Column1", "Column2", ...],
  "rows": [["value1", "value2", ...], ...],
  "description": "Brief description of the generated data"
}

Guidelines:
- Generate realistic, relevant sample data
- Include 10-20 rows of data
- Use appropriate data types (numbers, dates, text)
- Make data coherent and meaningful`
          },
          {
            role: 'user',
            content: `Generate a spreadsheet for: ${description}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
      });

      const generatedData = JSON.parse(response.choices[0].message.content);

      // Generate the actual spreadsheet
      const result = await this.generateSpreadsheet(generatedData.rows, {
        ...options,
        title: generatedData.title,
        headers: generatedData.headers
      });

      result.description = generatedData.description;

      return result;

    } catch (error) {
      this.logger.error('Failed to generate from description', { error: error.message });
      throw new Error('Failed to generate spreadsheet from description: ' + error.message);
    }
  }

  async analyzeExistingSpreadsheet(filepath) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filepath);

      const analysis = {
        filename: path.basename(filepath),
        sheets: [],
        totalRows: 0,
        totalColumns: 0
      };

      workbook.eachSheet(worksheet => {
        const sheetInfo = {
          name: worksheet.name,
          rowCount: worksheet.rowCount,
          columnCount: worksheet.columnCount,
          headers: [],
          dataTypes: {}
        };

        // Extract headers (first row)
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell(cell => {
          sheetInfo.headers.push(cell.value?.toString() || '');
        });

        // Analyze data types
        sheetInfo.headers.forEach((header, index) => {
          const columnValues = [];
          for (let rowNum = 2; rowNum <= Math.min(worksheet.rowCount, 100); rowNum++) {
            const cell = worksheet.getCell(rowNum, index + 1);
            if (cell.value !== null && cell.value !== undefined) {
              columnValues.push(cell.value);
            }
          }

          sheetInfo.dataTypes[header] = this.analyzeColumnDataType(columnValues);
        });

        analysis.sheets.push(sheetInfo);
        analysis.totalRows += sheetInfo.rowCount;
        analysis.totalColumns = Math.max(analysis.totalColumns, sheetInfo.columnCount);
      });

      return analysis;

    } catch (error) {
      this.logger.error('Failed to analyze spreadsheet', { error: error.message });
      throw new Error('Failed to analyze spreadsheet: ' + error.message);
    }
  }

  analyzeColumnDataType(values) {
    if (values.length === 0) return 'empty';

    const types = {
      number: 0,
      date: 0,
      text: 0,
      boolean: 0
    };

    values.forEach(value => {
      if (typeof value === 'number') {
        types.number++;
      } else if (value instanceof Date) {
        types.date++;
      } else if (typeof value === 'boolean') {
        types.boolean++;
      } else {
        types.text++;
      }
    });

    const maxType = Object.keys(types).reduce((a, b) => types[a] > types[b] ? a : b);
    return {
      primaryType: maxType,
      distribution: types,
      uniqueValues: [...new Set(values)].length,
      totalValues: values.length
    };
  }

  getStatus() {
    return {
      ready: this.isReady,
      outputDirectory: this.outputDir,
      supportedFormats: ['xlsx', 'csv'],
      features: {
        aiGeneration: !!this.openai,
        styling: true,
        autoSizing: true,
        analysis: !!this.openai,
        charts: false // Note: Basic chart support, not full implementation
      }
    };
  }
}

module.exports = SpreadsheetService;