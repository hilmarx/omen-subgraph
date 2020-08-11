import { BigInt, log, Address } from '@graphprotocol/graph-ts'

import { FixedProductMarketMakerCreation } from '../generated/FPMMDeterministicFactory/FPMMDeterministicFactory'
import { FixedProductMarketMaker, Condition, Question } from '../generated/schema'
import { FixedProductMarketMaker as FixedProductMarketMakerTemplate } from '../generated/templates'
import { zero, secondsPerHour, hoursPerDay } from './constants';
import { joinDayAndVolume } from './day-volume-utils';
import { updateScaledVolumes, getCollateralScale, setLiquidity } from './fpmm-utils';

export function handleFixedProductMarketMakerCreation(event: FixedProductMarketMakerCreation): void {
  let address = event.params.fixedProductMarketMaker;
  let addressHexString = address.toHexString();
  let conditionalTokensAddress = event.params.conditionalTokens.toHexString();

  if (conditionalTokensAddress != '{{ConditionalTokens.addressLowerCase}}') {
    log.info(
      'cannot index market maker {}: using conditional tokens {}',
      [addressHexString, conditionalTokensAddress],
    );
    return;
  }

  let fpmm = new FixedProductMarketMaker(addressHexString);

  fpmm.creator = event.params.creator;
  fpmm.creationTimestamp = event.block.timestamp;

  fpmm.collateralToken = event.params.collateralToken;
  fpmm.fee = event.params.fee;

  let conditionIds = event.params.conditionIds;
  let outcomeTokenCount = 1;
  let conditionIdStrs = new Array<string>(conditionIds.length);
  for(let i = 0; i < conditionIds.length; i++) {
    let conditionIdStr = conditionIds[i].toHexString();

    let condition = Condition.load(conditionIdStr);
    if(condition == null) {
      log.error(
        'failed to create market maker {}: condition {} not prepared',
        [addressHexString, conditionIdStr],
      );
      return;
    }

    outcomeTokenCount *= condition.outcomeSlotCount;
    conditionIdStrs[i] = conditionIdStr;
  }
  fpmm.conditions = conditionIdStrs;
  fpmm.outcomeSlotCount = outcomeTokenCount;
  fpmm.indexedOnQuestion = false;

  fpmm.curatedByDxDao = false;

  if(conditionIdStrs.length == 1) {
    let conditionIdStr = conditionIdStrs[0];
    fpmm.condition = conditionIdStr;

    let condition = Condition.load(conditionIdStr);
    if(condition == null) {
      log.error(
        'failed to create market maker {}: condition {} not prepared',
        [addressHexString, conditionIdStr],
      );
      return;
    }

    let questionIdStr = condition.questionId.toHexString();
    fpmm.question = questionIdStr;
    let question = Question.load(questionIdStr);
    if(question != null) {
      fpmm.templateId = question.templateId;
      fpmm.data = question.data;
      fpmm.title = question.title;
      fpmm.outcomes = question.outcomes;
      fpmm.category = question.category;
      fpmm.language = question.language;
      fpmm.arbitrator = question.arbitrator;
      fpmm.openingTimestamp = question.openingTimestamp;
      fpmm.timeout = question.timeout;

      if(question.indexedFixedProductMarketMakers.length < 100) {
        fpmm.currentAnswer = question.currentAnswer;
        fpmm.currentAnswerBond = question.currentAnswerBond;
        fpmm.currentAnswerTimestamp = question.currentAnswerTimestamp;
        fpmm.isPendingArbitration = question.isPendingArbitration;
        fpmm.arbitrationOccurred = question.arbitrationOccurred;
        fpmm.answerFinalizedTimestamp = question.answerFinalizedTimestamp;
        let fpmms = question.indexedFixedProductMarketMakers;
        fpmms.push(addressHexString);
        question.indexedFixedProductMarketMakers = fpmms;
        question.save();
        fpmm.indexedOnQuestion = true;
      } else {
        log.warning(
          'cannot continue updating live question (id {}) properties on fpmm {}',
          [questionIdStr, addressHexString],
        );
      }
    }
  }

  let outcomeTokenAmounts = new Array<BigInt>(outcomeTokenCount);
  for(let i = 0; i < outcomeTokenAmounts.length; i++) {
    outcomeTokenAmounts[i] = zero;
  }

  let collateralScale = getCollateralScale(fpmm.collateralToken as Address);
  let collateralScaleDec = collateralScale.toBigDecimal();
  setLiquidity(fpmm, outcomeTokenAmounts, collateralScaleDec);

  let currentDay = event.block.timestamp.div(secondsPerHour).div(hoursPerDay);

  fpmm.lastActiveDay = currentDay;
  fpmm.collateralVolumeBeforeLastActiveDay = zero;

  fpmm.collateralVolume = zero;
  fpmm.runningDailyVolume = zero;
  fpmm.lastActiveDayAndRunningDailyVolume = joinDayAndVolume(currentDay, zero);

  updateScaledVolumes(fpmm, collateralScale, collateralScaleDec, currentDay);

  fpmm.save();

  FixedProductMarketMakerTemplate.create(address);
}
