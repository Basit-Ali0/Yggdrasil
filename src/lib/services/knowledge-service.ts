import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

export interface GDPRArticle {
    chapter: string;
    chapter_title: string;
    article: string;
    article_title: string;
    sub_article: string;
    gdpr_text: string;
    href: string;
}

export interface GDPRViolation {
    id: string;
    country: string;
    price: number;
    authority: string;
    date: string;
    controller: string;
    article_violated: string;
    type: string;
    source: string;
    summary: string;
}

class KnowledgeService {
    private textData: GDPRArticle[] = [];
    private violationData: GDPRViolation[] = [];
    private initialized = false;

    private async init() {
        if (this.initialized) return;

        try {
            const textPath = path.join(process.cwd(), 'public', 'gdpr_text.csv');
            const violationsPath = path.join(process.cwd(), 'public', 'gdpr_violations.csv');

            const textCsv = fs.readFileSync(textPath, 'utf8');
            const violationsCsv = fs.readFileSync(violationsPath, 'utf8');

            this.textData = Papa.parse(textCsv, { header: true, skipEmptyLines: true }).data as GDPRArticle[];
            
            const rawViolations = Papa.parse(violationsCsv, { header: true, skipEmptyLines: true }).data as any[];
            this.violationData = rawViolations.map(v => ({
                ...v,
                country: v.name, // The header in CSV is 'name' but it represents country
                price: parseInt(v.price) || 0
            }));

            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize KnowledgeService:', error);
        }
    }

    async getArticleText(articleNumber: string): Promise<GDPRArticle[]> {
        await this.init();
        // Clean input: "Article 5" -> "5", "Art. 5" -> "5"
        const cleanNumber = articleNumber.replace(/[^0-9]/g, '');
        return this.textData.filter(a => a.article === cleanNumber);
    }

    async getViolationsForArticle(articleNumber: string): Promise<GDPRViolation[]> {
        await this.init();
        const cleanNumber = articleNumber.replace(/[^0-9]/g, '');
        const pattern = new RegExp(`Art\\.\\s*${cleanNumber}`, 'i');
        
        return this.violationData.filter(v => pattern.test(v.article_violated));
    }

    async getBenchmarkData(articleNumber: string) {
        await this.init();
        const violations = await this.getViolationsForArticle(articleNumber);
        
        if (violations.length === 0) return null;

        const totalFine = violations.reduce((sum, v) => sum + v.price, 0);
        const avgFine = totalFine / violations.length;
        const maxFine = Math.max(...violations.map(v => v.price));
        
        // Pick a random summary for context
        const randomViolation = violations[Math.floor(Math.random() * violations.length)];

        return {
            avgFine,
            maxFine,
            count: violations.length,
            sampleSummary: randomViolation.summary,
            sampleController: randomViolation.controller,
            sampleCountry: randomViolation.country
        };
    }
}

export const knowledgeService = new KnowledgeService();
