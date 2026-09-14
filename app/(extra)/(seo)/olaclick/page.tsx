import ComparisonBlogArticle from "@/components/common/blog/ComparisonBlogArticle";
import {
    createComparisonMetadata,
    getComparisonPage,
} from "@/lib/seo/comparisonPages";

const comparison = getComparisonPage("olaclick");

export const metadata = createComparisonMetadata(comparison);

export default function Page() {
    return <ComparisonBlogArticle comparison={comparison} />;
}
