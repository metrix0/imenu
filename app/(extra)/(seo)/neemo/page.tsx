import ComparisonSeoPage from "@/components/common/ComparisonSeoPage";
import {
    createComparisonMetadata,
    getComparisonPage,
} from "@/lib/seo/comparisonPages";

const comparison = getComparisonPage("neemo");

export const metadata = createComparisonMetadata(comparison);

export default function Page() {
    return <ComparisonSeoPage {...comparison} />;
}
