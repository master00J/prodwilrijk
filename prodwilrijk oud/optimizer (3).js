class Optimizer {
    constructor(sheetWidth, sheetHeight, pieces, sawKerf = 4) {
        this.sheetWidth = sheetWidth;
        this.sheetHeight = sheetHeight;
        this.pieces = pieces;
        this.sawKerf = sawKerf; // De dikte van de zaag
    }

    sortPiecesByArea() {
        this.pieces.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    }

    canPlace(grid, x, y, width, height) {
        if (x + width > grid[0].length || y + height > grid.length) return false;
        for (let i = y; i < y + height; i++) {
            for (let j = x; j < x + width; j++) {
                if (grid[i][j] !== 0) return false;
            }
        }
        return true;
    }

    fill(grid, x, y, width, height) {
        for (let i = y; i < y + height; i++) {
            for (let j = x; j < x + width; j++) {
                grid[i][j] = 1;
            }
        }
    }

    createGrid(width, height) {
        return Array.from({ length: height }, () => Array(width).fill(0));
    }

    optimize() {
        this.sortPiecesByArea();
        let sheets = [];
        let currentSheet = this.createGrid(this.sheetWidth, this.sheetHeight);
        sheets.push(currentSheet);

        let cuts = [];

        for (let piece of this.pieces) {
            for (let i = 0; i < piece.quantity; i++) {
                let placed = false;
                for (let sheet of sheets) {
                    for (let y = 0; y <= sheet.length - piece.height; y++) {
                        for (let x = 0; x <= sheet[0].length - piece.width; x++) {
                            // Neem de zaagsnede mee in de ruimte die nodig is
                            if (this.canPlace(sheet, x, y, piece.width + this.sawKerf, piece.height + this.sawKerf)) {
                                this.fill(sheet, x, y, piece.width, piece.height);
                                cuts.push({ x, y, width: piece.width, height: piece.height });
                                placed = true;
                                break;
                            }
                        }
                        if (placed) break;
                    }
                    if (placed) break;
                }
                if (!placed) {
                    currentSheet = this.createGrid(this.sheetWidth, this.sheetHeight);
                    this.fill(currentSheet, 0, 0, piece.width, piece.height);
                    cuts.push({ x: 0, y: 0, width: piece.width, height: piece.height });
                    sheets.push(currentSheet);
                }
            }
        }

        return {
            sheetsUsed: sheets.length,
            cuts: cuts
        };
    }
}

module.exports = Optimizer;
