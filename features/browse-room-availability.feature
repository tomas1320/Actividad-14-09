Feature: Browse room availability
  As a user
  I want to see rooms available for a time slot
  So that I can choose where to work

  Scenario: Show rooms available for the requested interval
    Given the coworking rooms are available
    When I search rooms on "2026-10-15" from "10:00" to "11:00"
    Then the response status should be 200
    And the available rooms should include "Sala A"

  Scenario: Exclude a room occupied during the requested interval
    Given "Sala A" has a confirmed booking on "2026-10-15" from "10:00" to "11:00"
    When I search rooms on "2026-10-15" from "10:30" to "11:30"
    Then the response status should be 200
    And the available rooms should not include "Sala A"

  Scenario: Reject an invalid date
    Given the coworking rooms are available
    When I search rooms on "2026-02-31" from "10:00" to "11:00"
    Then the response status should be 400
