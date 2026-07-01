/**
 * 재건축 사업성 계산기 핵심 유틸리티 (법정 규제 반영)
 */

// 신축 평형별 기본 데이터 (필요 대지지분 및 계약면적 표준값)
export const NEW_APARTMENT_TYPES = {
  25: {
    name: '25평형 (전용 59㎡)',
    neededLandShare: 9.5, // 신축 25평을 짓기 위해 필요한 대지지분 (평)
    contractAreaRatio: 1.6, // 분양면적 대비 계약면적(공사비 산정 기준) 비율
  },
  34: {
    name: '34평형 (전용 84㎡)',
    neededLandShare: 12.7, // 신축 34평을 짓기 위해 필요한 대지지분 (평)
    contractAreaRatio: 1.65,
  },
  40: {
    name: '40평형 (전용 101㎡)',
    neededLandShare: 15.2, // 신축 40평을 짓기 위해 필요한 대지지분 (평)
    contractAreaRatio: 1.7,
  }
};

/**
 * 용도지역별 법정 용적률 데이터 정의
 */
export const ZONE_REGULATORY_LIMITS = {
  '제1종일반주거지역': { baseFar: 150, maxFar: 200 },
  '제2종일반주거지역': { baseFar: 200, maxFar: 250 },
  '제3종일반주거지역': { baseFar: 250, maxFar: 300 },
  '준공업지역': { baseFar: 250, maxFar: 400 },
  '준주거지역': { baseFar: 300, maxFar: 400 },
  '일반상업지역': { baseFar: 400, maxFar: 800 }
};

/**
 * 재건축 사업성 및 투자 수익성 계산 (서울시 및 법정 임대주택 기부채납 규정 반영)
 * 
 * @param {Object} inputs 입력 변수들
 * @param {number} inputs.existingLandShare 기존 평균 대지지분 (평)
 * @param {number} inputs.targetSize 신축 희망 평형 (25, 34, 40)
 * @param {number} inputs.donationRatio 기부채납 비율 (%)
 * @param {number} inputs.constructionCost 평당 공사비 (만원)
 * @param {number} inputs.generalSalesPrice 평당 일반분양가 (만원)
 * @param {number} inputs.extraCostRatio 제반사업비 비율 (공사비 대비 %)
 * @param {number} [inputs.recentPrice] 기존 보유 아파트 최근 실거래가 (만원)
 * @param {number} [inputs.nearNewPricePerPyung] 인근 신축 평당 가격 (만원)
 * @param {string} [inputs.zoneRegion] 용도지역명 (예: '제3종일반주거지역', '준공업지역' 등)
 * @param {number} [inputs.targetFar] 사용자가 원하는 신축 타겟 용적률 (%)
 */
export function calculateReconstruction({
  existingLandShare,
  targetSize,
  donationRatio = 10,
  constructionCost = 800,
  generalSalesPrice = 3500,
  extraCostRatio = 30,
  recentPrice = 0,
  nearNewPricePerPyung = 0,
  zoneRegion = '제3종일반주거지역',
  targetFar = 300,
  complexAvgLandShare = 15.0,
  complexAvgPyung = 25.0
}) {
  const typeInfo = NEW_APARTMENT_TYPES[targetSize] || NEW_APARTMENT_TYPES[34];
  
  // 용도지역에 따른 기준 용적률 및 최대 상한 용적률 획득
  const zoneLimit = ZONE_REGULATORY_LIMITS[zoneRegion] || ZONE_REGULATORY_LIMITS['제3종일반주거지역'];
  const baseFar = zoneLimit.baseFar;
  const maxFar = zoneLimit.maxFar;
  
  // 사용자가 입력하거나 가져온 타겟 용적률이 한도를 초과하지 않도록 제한
  const finalTargetFar = Math.min(targetFar, maxFar);
  
  // 1. 기반시설(토지) 기부채납 후 실사용 대지지분 산출
  const donationMultiplier = 1 - (donationRatio / 100);
  const realLandShare = existingLandShare * donationMultiplier;
  
  // 2. 임대주택 기부채납 (용적률 증가분 50% 반납 규정)
  let rentalFarContribution = 0;
  if (finalTargetFar > baseFar) {
    const increasedFar = finalTargetFar - baseFar; 
    rentalFarContribution = increasedFar * 0.5;
  }
  const rentalRatio = rentalFarContribution / finalTargetFar; 

  // ==========================================
  // [투트랙 정통 비례율 모델: 단지 평균 비례율 도출 -> 개인 적용]
  // ==========================================
  
  // 3. 가상 단지 평균 모델 설정 (단지 실제 평균값을 기반으로 구성)
  const virtualLandShare = complexAvgLandShare || 15.0;
  const virtualTargetSize = complexAvgPyung ? Math.round(complexAvgPyung + 4) : 30; // 보통 기존 평균평수 + 4평 정도를 신축 주력평형으로 설정
  const virtualContractAreaRatio = 1.62; // 가상 주력평형 계약면적 환산비율

  const virtualRealLandShare = virtualLandShare * donationMultiplier;
  const contractAreaMultiplier = 1.6; // 용적률 대비 실제 시공면적 배수
  const virtualTotalContractArea = virtualRealLandShare * (finalTargetFar / 100) * contractAreaMultiplier; 
  const virtualRentalContractArea = virtualRealLandShare * (rentalFarContribution / 100) * contractAreaMultiplier; 
  
  const virtualMemberContractArea = virtualTargetSize * virtualContractAreaRatio; 
  let virtualGeneralContractArea = virtualTotalContractArea - virtualMemberContractArea - virtualRentalContractArea; 
  
  // 마이너스 방어 로직 (일반분양이 안 나오는 한계단지일 경우 비례율 페널티)
  let generalPenalty = 0;
  if (virtualGeneralContractArea < 0) {
    generalPenalty = Math.abs(virtualGeneralContractArea) * 5;
    virtualGeneralContractArea = 0;
  }

  // 총 분양 수입 (가상 단지 1세대 기준 매출)
  const memberSalesPrice = generalSalesPrice * 0.85; // 조합원 분양가는 일반분양가의 85% 적용 (현실화)
  const virtualMemberSalesRevenue = virtualTargetSize * memberSalesPrice;
  const virtualGeneralSupplyArea = virtualGeneralContractArea / contractAreaMultiplier; 
  const virtualGeneralSalesRevenue = virtualGeneralSupplyArea * generalSalesPrice;
  const virtualRentalRevenue = virtualRentalContractArea * 350; // 임대주택은 평당 350만 건축비 보전
  
  const virtualTotalRevenue = virtualMemberSalesRevenue + virtualGeneralSalesRevenue + virtualRentalRevenue;

  // 총 사업비 (가상 단지 1세대 지출)
  const virtualNetConstructionCost = virtualTotalContractArea * constructionCost; 
  const virtualExtraCost = virtualNetConstructionCost * (extraCostRatio / 100); 
  const virtualTotalCost = virtualNetConstructionCost + virtualExtraCost;

  // 가상 단지 1세대의 종전자산평가액 (감정가 기준: 단지 평균 평수 * 주변신축평당가의 60% 로 보수적 산정)
  // 인근 신축 평당가가 0일 경우, 일반 분양가를 대신 사용합니다.
  const effectiveNearNewPrice = nearNewPricePerPyung > 0 ? nearNewPricePerPyung : (generalSalesPrice || 3500);
  const virtualAppraisalValue = (complexAvgPyung || virtualLandShare * 2) * (effectiveNearNewPrice * 0.6);

  // [단지 공통 비례율 산출]
  let proportionalRate = 100;
  if (virtualAppraisalValue > 0) {
    proportionalRate = (virtualTotalRevenue - virtualTotalCost) / virtualAppraisalValue * 100;
  }
  proportionalRate -= generalPenalty;


  // ==========================================
  // [개인 권리가액 및 분담금 적용]
  // ==========================================

  // 4. 내 종전자산 감정평가액 산출
  // 실거래가가 없으면, 내 대지지분을 통해 추정한 내 기존평수 * 주변신축평당가의 60%를 보수적 감정가로 산정
  // (구로주공 19평 기준: 19평 * 3400 * 0.6 = 약 3.87억 -> 기존 낡은 주공의 보수적 감정가 반영)
  const myExistingPyung = existingLandShare * 1.8; // 주공아파트 특성 반영(지분*1.8)
  const appraisalValue = recentPrice > 0 
    ? recentPrice * 0.85 
    : myExistingPyung * (effectiveNearNewPrice * 0.6);

  // 5. 내 권리가액 산출
  const rightsValue = appraisalValue * (proportionalRate / 100);
  
  // 6. 내 최종 분담금 = 내가 신청한 신축 분양가 - 내 권리가액
  const myTargetSalesRevenue = targetSize * memberSalesPrice;
  const estimatedContribution = myTargetSalesRevenue - rightsValue;

  // 하단 호환성 유지용 (본인 지분 기준)
  const myTotalContractArea = realLandShare * (finalTargetFar / 100) * contractAreaMultiplier;
  const myRentalContractArea = realLandShare * (rentalFarContribution / 100) * contractAreaMultiplier;
  const myMemberContractArea = targetSize * (NEW_APARTMENT_TYPES[targetSize] ? NEW_APARTMENT_TYPES[targetSize].contractAreaRatio : 1.65);
  const myGeneralContractArea = myTotalContractArea - myMemberContractArea - myRentalContractArea;
  
  const generalSupplyArea = myGeneralContractArea / contractAreaMultiplier;
  const totalGeneralSalesRevenue = generalSupplyArea * generalSalesPrice;
  const totalCost = myTotalContractArea * constructionCost * (1 + extraCostRatio / 100);

  // 9. 투자 수익성 계산 (ROI)
  let investmentAnalysis = null;
  if (recentPrice > 0) {
    const totalAcquisitionPrice = recentPrice + estimatedContribution;
    const finalPricePerPyung = nearNewPricePerPyung > 0 ? nearNewPricePerPyung : (generalSalesPrice * 1.1);
    const expectedValue = targetSize * finalPricePerPyung;
    const expectedMargin = expectedValue - totalAcquisitionPrice;
    const expectedROI = (expectedMargin / totalAcquisitionPrice) * 100;
    
    investmentAnalysis = {
      recentPrice: Math.round(recentPrice),
      totalAcquisitionPrice: Math.round(totalAcquisitionPrice),
      expectedValue: Math.round(expectedValue),
      expectedMargin: Math.round(expectedMargin),
      expectedROI: Math.round(expectedROI * 10) / 10
    };
  }
  
  // 10. 비례율 기반 사업성 등급 산출 (Score 변수 재활용)
  let businessGrade = '보통';
  let gradeColor = 'var(--color-warning)';
  let summaryText = '';
  
  // 지도 호환성을 위해 score 변수에 비례율을 대입
  let score = Math.round(proportionalRate * 10) / 10;
  
  if (score >= 120) {
    businessGrade = '💎 플래티넘 (최우수)';
    gradeColor = '#a8c6fa';
    summaryText = `비례율 ${score}%의 초대박 단지입니다. 일반분양 매출이 사업비를 아득히 뛰어넘어, 높은 권리가액 인정으로 분담금이 대폭 줄어듭니다.`;
  } else if (score >= 100) {
    businessGrade = '🟢 녹색 (우수)';
    gradeColor = 'var(--color-success)';
    summaryText = `비례율 ${score}%로 우수한 사업성을 확보했습니다. 종전자산보다 더 큰 가치를 인정받아 안전하게 재건축을 추진할 수 있습니다.`;
  } else if (score >= 80) {
    businessGrade = '🟡 주황색 (보통)';
    gradeColor = 'var(--color-warning)';
    summaryText = `비례율 ${score}%입니다. 권리가액이 깎여나가며 일정 수준 이상의 자기 분담금이 발생합니다. 공사비 절감이 핵심 과제입니다.`;
  } else {
    businessGrade = '🔴 빨간색 (위험)';
    gradeColor = 'var(--color-danger)';
    summaryText = `비례율 ${score}% 미만으로 사업성이 매우 악화되어 있습니다. 공사비 급등과 적은 분양 수입으로 인해 막대한 분담금 폭탄이 우려됩니다.`;
  }
  
  // 지도 및 하위 호환성을 위해 generalContributionShare, totalMemberCost 등은 대체값 유지
  return {
    realLandShare: Math.round(realLandShare * 100) / 100,
    generalContributionShare: Math.round(generalSupplyArea * 100) / 100,
    totalMemberCost: Math.round(totalCost),
    generalContributionProfit: Math.round(totalGeneralSalesRevenue),
    estimatedContribution: Math.round(estimatedContribution),
    rentalFarContribution,
    rentalRatio: Math.round(rentalRatio * 1000) / 10, 
    businessGrade,
    gradeColor,
    score, // 비례율 % 가 담김
    appraisalValue: Math.round(appraisalValue),
    rightsValue: Math.round(rightsValue),
    proportionalRate: score,
    summaryText,
    investmentAnalysis,
    inputs: {
      existingLandShare,
      targetSize,
      donationRatio,
      constructionCost,
      generalSalesPrice,
      extraCostRatio,
      recentPrice,
      nearNewPricePerPyung,
      zoneRegion,
      targetFar: finalTargetFar
    }
  };
}

/**
 * 기존 평형 기준 평균 대지지분 대략적 추정치 반환
 */
export function estimateExistingLandShare(currentPyung) {
  if (currentPyung <= 15) return 8.5;
  if (currentPyung <= 20) return 11.5;
  if (currentPyung <= 25) return 13.0;
  if (currentPyung <= 30) return 14.5;
  if (currentPyung <= 35) return 16.5;
  return 18.0;
}
