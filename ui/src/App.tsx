import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Landing } from './routes/Landing';
import { Offerings } from './routes/Offerings';
import { OfferingDetail } from './routes/OfferingDetail';
import { Results } from './routes/Results';
import { Verify } from './routes/Verify';
import { Issue } from './routes/Issue';
import { Portfolio } from './routes/Portfolio';
import { NotFound } from './routes/NotFound';

export const App = () => (
  <Layout>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/offerings" element={<Offerings />} />
      <Route path="/offerings/:address" element={<OfferingDetail />} />
      <Route path="/offerings/:address/results" element={<Results />} />
      <Route path="/verify" element={<Verify />} />
      <Route path="/verify/:address" element={<Verify />} />
      <Route path="/issue" element={<Issue />} />
      <Route path="/portfolio" element={<Portfolio />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Layout>
);
