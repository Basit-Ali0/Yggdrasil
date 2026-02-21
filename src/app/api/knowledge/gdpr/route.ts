import { NextRequest, NextResponse } from 'next/server';
import { knowledgeService } from '@/lib/services/knowledge-service';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const article = searchParams.get('article');

    if (!article) {
        return NextResponse.json({ error: 'Article parameter is required' }, { status: 400 });
    }

    try {
        const text = await knowledgeService.getArticleText(article);
        const benchmark = await knowledgeService.getBenchmarkData(article);

        return NextResponse.json({
            article,
            full_text: text,
            benchmark
        });
    } catch (error) {
        console.error('Knowledge API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
