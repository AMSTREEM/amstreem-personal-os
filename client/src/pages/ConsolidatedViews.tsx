import { LibraryPage } from './LibraryPage';
import { ReviewsPage } from './ReviewsPage';
import { InsightsPage } from './InsightsPage';
import { RitualsPage } from './RitualsPage';
import { SelfControlPage } from './SelfControlPage';
import { PageHeader } from '../components/ui';

export function HabitsSelfControlView() {
  return <div className="stack habits-self-control-view daily-rhythm-sanctuary">
    <PageHeader eyebrow="ROOM 02 / DAILY RHYTHM" title="Habits & Self-Control" description="Build the routines you want to keep, honour your personal commitments, and learn from the days that do not go to plan." />
    <section className="habits-module-section habits-module-section--self-control">
      <div className="habits-module-heading"><span className="module-kicker">01 / SELF-CONTROL COMMITMENTS</span><h2>Commitments you choose to keep.</h2><p>Track clean days honestly, and use a slip as information—not a verdict.</p></div>
      <SelfControlPage embedded />
    </section>
    <section className="habits-module-section habits-module-section--positive">
      <div className="habits-module-heading"><span className="module-kicker">02 / DAILY POSITIVE HABITS</span><h2>Small actions, repeated.</h2><p>Check off the routines you want to build and watch consistency take shape.</p></div>
      <RitualsPage embedded />
    </section>
  </div>;
}

 
export function LearningLibraryView() {
  return <div className="stack growth-combined-view">
    <section className="growth-view-section" aria-labelledby="growth-library-heading">
      <div className="growth-section-heading"><span className="eyebrow">KNOWLEDGE / PRIVATE LIBRARY</span><h2 id="growth-library-heading">Private Library</h2><p>Keep books, articles, references and private notes close to the work that matters.</p></div>
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
