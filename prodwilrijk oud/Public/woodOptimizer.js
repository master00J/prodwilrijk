// woodOptimizer.js

class WoodOptimizer {
    constructor() {
        this.SAW_THICKNESS = 5; // mm
        this.MIN_REUSABLE_LENGTH = 300; // mm voor herbruikbare stukken
    }

    piecesFromPlank(plankLength, pieces) {
        const totalCuts = pieces.length - 1;
        const totalSawLoss = totalCuts * this.SAW_THICKNESS;
        const totalLengthNeeded = pieces.reduce((a, b) => a + b.length, 0) + totalSawLoss;
        return {
            fits: totalLengthNeeded <= plankLength,
            wasteLength: plankLength - totalLengthNeeded,
            sawCuts: totalCuts,
            usedLength: totalLengthNeeded
        };
    }

    generatePatterns(plankLength, requirements, maxPatternSize = 5) {
        const patterns = [];
        const sortedReqs = [...requirements].sort((a, b) => b.length - a.length);

        const backtrack = (currentPattern, remainingLength, startIdx, reqs) => {
            const result = this.piecesFromPlank(plankLength, currentPattern);
            
            if (result.fits) {
                patterns.push({
                    pieces: [...currentPattern],
                    waste: result.wasteLength,
                    sawCuts: result.sawCuts,
                    efficiency: (plankLength - result.wasteLength) / plankLength
                });
            } else {
                return; // Pattern past niet
            }

            if (currentPattern.length >= maxPatternSize) return;

            for (let i = startIdx; i < reqs.length; i++) {
                const piece = reqs[i];
                if (piece.length <= remainingLength) {
                    const newPattern = [...currentPattern, piece];
                    const newResult = this.piecesFromPlank(plankLength, newPattern);
                    if (newResult.fits) {
                        backtrack(newPattern, plankLength - newResult.usedLength, i, reqs);
                    }
                }
            }
        };

        backtrack([], plankLength, 0, sortedReqs);
        return patterns.sort((a, b) => b.efficiency - a.efficiency);
    }

    findBestStock(requirements, stock) {
        const matchingStock = stock.filter(s =>
            s.soort.toLowerCase() === requirements[0].houtsoort.toLowerCase() &&
            s.dikte >= requirements[0].dikte &&
            s.breedte >= requirements[0].breedte &&
            s.aantal > 0
        );

        // Sorteer op lengte (kortste eerst die nog past)
        return matchingStock.sort((a, b) => a.lengte - b.lengte);
    }

    optimizeForGroup(requirements, stock) {
        const solution = {
            usedPlanks: [],
            statistics: {
                totalWaste: 0,
                totalWood: 0,
                totalCuts: 0
            }
        };

        // Maak kopie van requirements met nog benodigde aantallen
        const remainingReqs = requirements.map(req => ({
            ...req,
            remainingNeeded: req.needed
        }));

        // Blijf optimaliseren totdat alle requirements vervuld zijn
        while (remainingReqs.some(req => req.remainingNeeded > 0)) {
            const availableStock = this.findBestStock(remainingReqs, stock);
            if (availableStock.length === 0) break;

            for (const stockItem of availableStock) {
                if (stockItem.aantal === 0) continue;

                // Genereer patronen voor deze plank
                const activeReqs = remainingReqs.filter(r => r.remainingNeeded > 0)
                    .map(r => ({ length: r.lengte, id: r.id }));
                const patterns = this.generatePatterns(stockItem.lengte, activeReqs);

                if (patterns.length > 0) {
                    // Gebruik het beste patroon
                    const bestPattern = patterns[0];
                    const pieceCounts = this.countPieces(bestPattern.pieces);
                    
                    // Bereken hoeveel planken we nodig hebben
                    const maxNeeded = Math.min(
                        stockItem.aantal,
                        this.calculatePlanksNeeded(pieceCounts, remainingReqs)
                    );

                    if (maxNeeded > 0) {
                        // Update remaining requirements
                        this.updateRemainingRequirements(remainingReqs, pieceCounts, maxNeeded);

                        // Update stock aantal
                        stockItem.aantal -= maxNeeded;

                        // Voeg toe aan solution
                        solution.usedPlanks.push({
                            plank: { ...stockItem, aantal: maxNeeded },
                            pattern: bestPattern.pieces,
                            count: maxNeeded,
                            waste: bestPattern.waste,
                            sawCuts: bestPattern.sawCuts
                        });

                        // Update statistics
                        solution.statistics.totalWaste += bestPattern.waste * maxNeeded;
                        solution.statistics.totalWood += stockItem.lengte * maxNeeded;
                        solution.statistics.totalCuts += bestPattern.sawCuts * maxNeeded;
                    }
                }
            }
        }

        // Calculate final statistics
        solution.statistics.wastePercentage = 
            (solution.statistics.totalWaste / solution.statistics.totalWood) * 100;

        return solution;
    }

    countPieces(pattern) {
        return pattern.reduce((counts, piece) => {
            counts[piece.id] = (counts[piece.id] || 0) + 1;
            return counts;
        }, {});
    }

    calculatePlanksNeeded(pieceCounts, requirements) {
        let minPlanks = Infinity;
        for (const req of requirements) {
            if (req.remainingNeeded > 0) {
                const piecesPerPattern = pieceCounts[req.id] || 0;
                if (piecesPerPattern > 0) {
                    const planksNeeded = Math.ceil(req.remainingNeeded / piecesPerPattern);
                    minPlanks = Math.min(minPlanks, planksNeeded);
                }
            }
        }
        return minPlanks === Infinity ? 0 : minPlanks;
    }

    updateRemainingRequirements(requirements, pieceCounts, numPlanks) {
        for (const req of requirements) {
            if (pieceCounts[req.id]) {
                req.remainingNeeded -= pieceCounts[req.id] * numPlanks;
            }
        }
    }
}

module.exports = WoodOptimizer;