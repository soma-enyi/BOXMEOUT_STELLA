# Market Resolution Implementation Plan

## Overview
Implement the `resolve_market` function to finalize market outcomes based on oracle consensus, marking winners and locking the market state.

## Technical Requirements

### 1. Storage Keys (Add to market.rs)
```rust
const ORACLE_KEY: &str = "oracle";
const WINNING_OUTCOME_KEY: &str = "winning_outcome";
const WINNER_SHARES_KEY: &str = "winner_shares";
const LOSER_SHARES_KEY: &str = "loser_shares";
```

### 2. Oracle Interface (Add to market.rs)
Define a trait to interact with the Oracle contract:
```rust
pub trait OracleInterface {
    fn check_consensus(env: &Env, market_id: BytesN<32>) -> bool;
    fn get_consensus_result(env: &Env, market_id: BytesN<32>) -> u32;
}
```

### 3. Update Initialize Function
- Accept `oracle: Address` parameter
- Store oracle address in persistent storage

### 4. Resolve Market Function Logic

#### Pre-conditions:
1. Current timestamp >= resolution_time
2. Market state is CLOSED (not OPEN or already RESOLVED)
3. Oracle consensus has been reached (check_consensus returns true)

#### Processing Steps:
1. Validate timing and state
2. Call oracle to check consensus
3. Retrieve final outcome from oracle (0 = NO, 1 = YES)
4. Update market state to RESOLVED
5. Store winning outcome
6. Calculate winner and loser pool shares
7. Emit MarketResolved event with (market_id, final_outcome, timestamp)

#### Error Handling:
- Panic if called before resolution_time
- Panic if market not in CLOSED state
- Panic if oracle consensus not reached
- Panic if trying to resolve twice

### 5. Unit Tests (in src/test.rs)

Create comprehensive unit tests:
- `test_resolve_market_happy_path()` - Normal resolution flow
- `test_resolve_before_resolution_time()` - Should panic
- `test_resolve_without_consensus()` - Should panic
- `test_resolve_twice()` - Should panic
- `test_resolve_market_event_emitted()` - Verify event emission
- `test_resolve_market_state_changes()` - Verify state transitions

### 6. Integration Tests (in tests/integration_test.rs)

Add integration test scenarios:
- Complete flow: market creation → betting → closing → oracle consensus → resolution
- Multi-oracle consensus scenarios
- Edge cases with different pool sizes

## Implementation Steps

1. **Add storage keys and oracle interface**
2. **Update initialize function** to accept and store oracle address
3. **Implement resolve_market function** with full validation and logic
4. **Implement helper functions** for calculating payouts
5. **Write unit tests** covering all acceptance criteria
6. **Write integration tests** for end-to-end scenarios
7. **Run tests** and verify all pass

## Acceptance Criteria Checklist

- [ ] Only callable after resolution_time
- [ ] Check Oracle.check_consensus() returns true
- [ ] Set final_outcome from oracle
- [ ] Change state from OPEN/CLOSED to RESOLVED
- [ ] Calculate winner shares and payout ratios
- [ ] Emit MarketResolved(market_id, final_outcome, timestamp)
- [ ] Unit tests implemented and passing
- [ ] Integration tests implemented and passing
- [ ] Cannot resolve before resolution_time (test)
- [ ] Cannot resolve without consensus (test)
- [ ] Cannot resolve twice (test)
- [ ] Event emitted correctly (test)

## Dependencies

- Oracle contract must implement:
  - `check_consensus(market_id) -> bool`
  - `get_consensus_result(market_id) -> u32`
  
## Notes

- Use cross-contract calls to interact with Oracle
- Ensure all state changes are atomic
- Follow Soroban best practices for storage and events
- Consider gas optimization for large markets
