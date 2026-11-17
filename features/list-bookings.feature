Feature: List a user's bookings
  As a registered user
  I want to view my bookings
  So that I can manage my schedule

  Scenario: List bookings for an existing user
    Given user "ana@example.com" has booked "Sala A" on "2026-10-15" from "10:00" to "11:00"
    When I list bookings for user "ana@example.com"
    Then the response status should be 200
    And the response should contain 1 booking

  Scenario: Reject a request for a user that does not exist
    Given user "caller@example.com" exists
    When I list bookings for user "missing@example.com"
    Then the response status should be 404

  Scenario: Return an empty list for a user without bookings
    Given user "ana@example.com" exists
    When I list bookings for user "ana@example.com"
    Then the response status should be 200
    And the response should contain 0 booking

  Scenario: Do not let a user view another user's bookings
    Given user "ana@example.com" exists
    And user "bob@example.com" exists
    When user "bob@example.com" tries to list bookings of user "ana@example.com"
    Then the response status should be 404
