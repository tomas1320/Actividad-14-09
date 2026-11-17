Feature: Cancel a booking
  As the owner of a booking
  I want to cancel it
  So that the room becomes available again

  Scenario: Cancel my confirmed booking
    Given user "ana@example.com" has booked "Sala A" on "2026-10-15" from "10:00" to "11:00"
    When user "ana@example.com" cancels that booking
    Then the response status should be 200
    And the booking status should be "CANCELLED"

  Scenario: Do not let another user cancel the booking
    Given user "ana@example.com" has booked "Sala A" on "2026-10-15" from "10:00" to "11:00"
    When user "bob@example.com" cancels that booking
    Then the response status should be 404

  Scenario: Make the room available after cancellation
    Given user "ana@example.com" has booked "Sala A" on "2026-10-15" from "10:00" to "11:00"
    When user "ana@example.com" cancels that booking
    And I search rooms on "2026-10-15" from "10:00" to "11:00"
    Then the response status should be 200
    And the available rooms should include "Sala A"
