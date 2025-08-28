import { useNavigate } from 'react-router-dom';

export const useNavigateToRateation = () => {
  const navigate = useNavigate();
  
  const navigateToRateation = (targetId: string) => {
    // Navigate directly to rateations with search filter for the specific ID
    navigate(`/rateations?search=${targetId}`);
  };
  
  return { navigateToRateation };
};