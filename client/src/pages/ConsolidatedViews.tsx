import { LibraryPage } from './LibraryPage';
import { LearningPage } from './LearningPage';
import { ReviewsPage } from './ReviewsPage';
import { InsightsPage } from './InsightsPage';
import { RitualsPage } from './RitualsPage';
import { SelfControlPage } from './SelfControlPage';

export function HabitsSelfControlView() {
  return <div className="stack habits-self-control-view">
    <PageHeader eyebrow="ROOM 02 / DAILY RHYTHM" title="Habits & Self-Control" description="Build the routines you want to keep, honour your personal commitments, and learn from the days that do not go to plan." />
    <SelfControlPage embedded />
    <RitualsPage embedded />
  </div>;
}

 
export function LearningLibraryView() {
  return <div className="stack growth-combined-view">
    <section className="growth-view-section" aria-labelledby="growth-learning-heading">
      <div className="growth-section-heading"><span className="eyebrow">KNOWLEDGE / LEARNING STUDIO</span><h2 id="growth-learning-heading">Learning paths</h2><p>Build skills through structured paths, lessons, study notes and focused sessions.</p></div>
      <LearningPage embedded />
    </section>
    <section className="growth-view-section" aria-labelledby="growth-library-heading">
      <div className="growth-section-heading"><span className="eyebrow">KNOWLEDGE / PRIVATE LIBRARY</span><h2 id="growth-library-heading">Reading & reference</h2><p>Keep books, articles, references and private notes close without mixing them into lesson plans.</p></div>
      <LibraryPage embedded />
    </section>
  </div>;
}

export function ReviewsInsightsView() {
  return <div className="stack growth-combined-view">
    <section className="growth-view-section" aria-labelledby="growth-reviews-heading">
      <div className="growth-section-heading"><span className="eyebrow">REFLECT / DAILY & WEEKLY</span><h2 id="growth-reviews-heading">Reviews</h2><p>Reflect on wins, challenges and lessons, then choose the priorities that deserve attention.</p></div>
      <ReviewsPage embedded />
    </section>
    <section className="growth-view-section" aria-labelledby="growth-insights-heading">
      <div className="growth-section-heading"><span className="eyebrow">REFLECT / PERSONAL INTELLIGENCE</span><h2 id="growth-insights-heading">Insights & activity trends</h2><p>Notice comparable focus patterns and evidence-based next steps from your recorded workspace activity.</p></div>
      <InsightsPage embedded />
    </section>
  </div>;
}
